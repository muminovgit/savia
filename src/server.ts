import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DATA_DIR,
  LANGS,
  OutOfStock,
  createOrder,
  getProduct,
  getPromo,
  getShopById,
  getShopBySlug,
  isSoldOut,
  listProducts,
  logQuestion,
  quote,
  shopBanners,
  shopPhones,
  sizesOf,
  usePromo,
} from "./db.js";
import type { Lang, Order, Product, Shop } from "./db.js";
import { answerQuestion } from "./ai.js";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const asLang = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : "uz");

/** Validates Telegram Mini App initData (HMAC with the bot token) and returns the Telegram user. */
export function validateInitData(initData: string | undefined, botToken: string | undefined): { id: number; name: string } | null {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const expected = createHmac("sha256", secret).update(check).digest();
    const given = Buffer.from(hash, "hex");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    if (Date.now() / 1000 - Number(params.get("auth_date") ?? 0) > 86400) return null;
    const user = JSON.parse(params.get("user") ?? "null");
    return user?.id ? { id: Number(user.id), name: [user.first_name, user.last_name].filter(Boolean).join(" ") } : null;
  } catch {
    return null;
  }
}

const serializeShop = (shop: Shop) => ({
  name: shop.name,
  slug: shop.slug,
  about: shop.about,
  phones: shopPhones(shop),
  address: shop.address,
  minOrder: shop.min_order,
  deliveryFee: shop.delivery_fee,
  freeFrom: shop.free_from,
  banners: shopBanners(shop).map((f) => `/photos/${f}`),
  contact: shop.contact,
  bot: process.env.BOT_USERNAME ?? "savia_shop_bot",
});

const serializeProduct = (p: Product) => {
  const stock = p.stock;
  return {
    id: p.id,
    category: p.category,
    price: p.price,
    oldPrice: p.old_price,
    currency: p.currency,
    attributes: p.attributes,
    translations: p.translations,
    photos: p.photos.map((f) => `/photos/${f}`),
    soldOut: isSoldOut(p),
    sizes: sizesOf(p).map((s) => ({ s, ok: stock![s] > 0, left: stock![s] > 0 && stock![s] <= 3 ? stock![s] : null })),
    totalLeft: stock && stock._ != null && stock._ > 0 && stock._ <= 3 ? stock._ : null,
  };
};

const WEB_DIR = fileURLToPath(new URL("./web/", import.meta.url));
const loadShell = () => readFileSync(`${WEB_DIR}index.html`, "utf8");

export function createServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "20kb" }));
  app.use("/photos", express.static(`${DATA_DIR}/photos`, { maxAge: "1d" }));
  app.use("/static", express.static(WEB_DIR, { maxAge: "5m", index: false }));

  app.get("/healthz", (_req, res) => void res.json({ ok: true }));

  // The Mini App shell. /app?slug=... or Telegram's startapp param pick the shop on the client; /s/:slug fixes it on the server.
  const sendShell = (slug: string) => (_req: express.Request, res: express.Response) =>
    void res.type("html").send(loadShell().replace("__SLUG__", esc(slug)));
  app.get("/app", sendShell(""));
  app.get("/s/:slug", (req, res) => {
    if (!getShopBySlug(req.params.slug)) return void res.status(404).send("Not found");
    sendShell(req.params.slug)(req, res);
  });
  // Links created by earlier versions
  app.get("/s/:slug/p/:id", (req, res) => void res.redirect(`/s/${encodeURIComponent(req.params.slug)}#/p/${Number(req.params.id)}`));
  app.get("/s/:slug/cart", (req, res) => void res.redirect(`/s/${encodeURIComponent(req.params.slug)}#/cart`));

  app.get("/api/shop/:slug", (req, res) => {
    const shop = getShopBySlug(req.params.slug);
    if (!shop) return void res.status(404).json({ error: "not found" });
    const products = listProducts(shop.id).map(serializeProduct);
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    res.json({ shop: serializeShop(shop), categories, products });
  });

  /** Validates cart lines against the shop and returns the products to price. */
  const parseItems = (shop: Shop, raw: unknown): { items: { product: Product; qty: number; size: string }[] } | { error: string } => {
    if (!Array.isArray(raw) || !raw.length || raw.length > 30) return { error: "bad request" };
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const merged = new Map<string, { id: number; size: string; qty: number }>();
    for (const it of raw) {
      const id = Number(it?.id);
      const qty = Number(it?.qty);
      const size = str(it?.size, 20);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) return { error: "bad item" };
      const key = `${id}|${size}`;
      merged.set(key, { id, size, qty: Math.min(20, (merged.get(key)?.qty ?? 0) + qty) });
    }
    const items: { product: Product; qty: number; size: string }[] = [];
    for (const { id, size, qty } of merged.values()) {
      const product = getProduct(id);
      if (!product || product.shop_id !== shop.id) return { error: "bad item" };
      const sizes = sizesOf(product);
      if (sizes.length && !sizes.includes(size)) return { error: "size required" };
      items.push({ product, qty, size: sizes.length ? size : "" });
    }
    return { items };
  };

  app.post("/api/quote", (req, res) => {
    const shop = getShopBySlug(String(req.body?.slug ?? ""));
    if (!shop) return void res.status(400).json({ error: "bad request" });
    const parsed = parseItems(shop, req.body?.items);
    if ("error" in parsed) return void res.status(400).json(parsed);
    const code = typeof req.body?.promo === "string" ? req.body.promo.trim() : "";
    const promo = code ? getPromo(shop.id, code) : undefined;
    const q = quote(shop, parsed.items, promo?.percent ?? 0);
    res.json({ ...q, promoOk: code ? !!promo : null, promoPercent: promo?.percent ?? 0, minOrder: shop.min_order });
  });

  const hits = new Map<string, number[]>();
  const tooMany = (ip: string) => {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > Number(process.env.ORDER_RATE_LIMIT ?? 5);
  };

  app.post("/api/orders", (req, res) => {
    if (tooMany(req.ip ?? "")) return void res.status(429).json({ error: "too many requests" });
    const b = req.body ?? {};
    const shop = getShopBySlug(String(b.slug ?? ""));
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const name = str(b.name, 80);
    const phone = str(b.phone, 30);
    const digits = phone.replace(/\D/g, "");
    if (!shop || !name || digits.length < 7 || digits.length > 15) return void res.status(400).json({ error: "bad request" });
    const parsed = parseItems(shop, b.items);
    if ("error" in parsed) return void res.status(400).json(parsed);
    const code = str(b.promo, 20);
    const promo = code ? getPromo(shop.id, code) : undefined;
    if (code && !promo) return void res.status(400).json({ error: "bad_promo" });
    const q = quote(shop, parsed.items, promo?.percent ?? 0);
    if (q.currency && shop.min_order > 0 && q.subtotal - q.discount < shop.min_order) {
      return void res.status(400).json({ error: "min_order", min: shop.min_order, currency: q.currency });
    }
    const buyer = validateInitData(req.get("x-tg-init") ?? undefined, process.env.BOT_TOKEN);
    let order: Order;
    try {
      order = createOrder(
        shop.id,
        { name, phone, address: str(b.address, 200), note: str(b.note, 300), buyer_tg_id: buyer?.id ?? null },
        parsed.items,
        q,
        promo?.code,
      );
    } catch (e) {
      if (e instanceof OutOfStock) return void res.status(409).json({ error: "out_of_stock", title: e.title, size: e.size, have: e.have });
      throw e;
    }
    if (promo) usePromo(shop.id, promo.code);
    notifyOrder?.(shop, order);
    notifyStock?.(shop, parsed.items.map((i) => i.product.id));
    res.json({ id: order.id, total: q.text, payment: shop.payment, contact: shop.contact });
  });

  app.post("/api/chat", async (req, res) => {
    const { productId, lang, question } = req.body ?? {};
    const product = getProduct(Number(productId));
    const q = typeof question === "string" ? question.trim().slice(0, 300) : "";
    if (!product || !q) return void res.status(400).json({ error: "bad request" });
    const shop = getShopById(product.shop_id)!;
    try {
      const r = await answerQuestion(product, shop.name, asLang(lang), q);
      logQuestion(product.id, q, !r.needsSeller);
      if (r.needsSeller) notifySeller?.(shop, product, q);
      res.json({ answer: r.answer });
    } catch (e) {
      console.error("chat failed", e);
      res.status(502).json({ answer: "Hozir javob bera olmayman, keyinroq urinib ko'ring." });
    }
  });

  return app;
}

/** Set by the bot so unanswered buyer questions reach the seller. */
let notifySeller: ((shop: Shop, product: Product, question: string) => void) | undefined;
let notifyStock: ((shop: Shop, productIds: number[]) => void) | undefined;
let notifyOrder: ((shop: Shop, order: Order) => void) | undefined;
export const setSellerNotifier = (fn: typeof notifySeller) => void (notifySeller = fn);
export const setStockNotifier = (fn: typeof notifyStock) => void (notifyStock = fn);
export const setOrderNotifier = (fn: typeof notifyOrder) => void (notifyOrder = fn);
