import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import {
  DATA_DIR,
  LANGS,
  OutOfStock,
  buyerCounts,
  createOrder,
  deleteProduct,
  findShopForUser,
  getOrder,
  getOrderItems,
  getProduct,
  listBuyerOrders,
  listOrders,
  listPromos,
  savePromo,
  setDiscount,
  setOrderStatus,
  setPromoActive,
  setStock,
  shopCategories,
  updateProduct,
  updateShop,

  getPromo,
  getShopById,
  getShopBySlug,
  isSoldOut,
  upsertBuyer,
  listProducts,
  logQuestion,
  quote,
  shopBanners,
  shopPhones,
  sizesOf,
  usePromo,
} from "./db.js";
import type { Lang, Order, OrderStatus, Product, Shop } from "./db.js";
import { answerQuestion } from "./ai.js";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const asLang = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : "uz");

/** Validates Telegram Mini App initData (HMAC with the bot token) and returns the Telegram user. */
export function validateInitData(initData: string | undefined, botToken: string | undefined): { id: number; name: string; canWrite: boolean } | null {
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
    return user?.id ? { id: Number(user.id), name: [user.first_name, user.last_name].filter(Boolean).join(" "), canWrite: user.allows_write_to_pm === true } : null;
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
  accent: shop.accent,
  link: process.env.MINIAPP_SHORTNAME
    ? `https://t.me/${process.env.BOT_USERNAME ?? "savia_shop_bot"}/${process.env.MINIAPP_SHORTNAME}?startapp=${shop.slug}`
    : "",
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

  // Resized copies of the photos (catalog cards should not download 1600px originals); cached on disk.
  mkdirSync(`${DATA_DIR}/cache`, { recursive: true });
  const IMG_WIDTHS = [240, 480, 800, 1200];
  app.get("/img/:file", async (req, res) => {
    const file = req.params.file;
    if (!/^[\w.-]{1,80}\.(jpe?g|png|webp)$/i.test(file)) return void res.status(404).end();
    const src = `${DATA_DIR}/photos/${file}`;
    if (!existsSync(src)) return void res.status(404).end();
    const want = Number(req.query.w);
    const w = IMG_WIDTHS.find((x) => x >= want) ?? (Number.isFinite(want) && want > 0 ? 1200 : 800);
    const cached = resolve(`${DATA_DIR}/cache/${w}-${file}.jpg`);
    try {
      if (!existsSync(cached)) {
        const tmp = `${cached}.${process.pid}.${Date.now()}`;
        await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(tmp);
        renameSync(tmp, cached);
      }
      res.set("Cache-Control", "public, max-age=604800, immutable").type("jpeg").sendFile(cached);
    } catch (e) {
      console.error("resize failed", e);
      res.status(500).end();
    }
  });
  app.use("/static", express.static(WEB_DIR, { maxAge: "5m", index: false }));

  app.get("/healthz", (_req, res) => void res.json({ ok: true }));

  // Public landing page (Uzbek/Russian). The origin is injected so link previews get an absolute image URL.
  app.get("/", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.type("html").send(readFileSync(`${WEB_DIR}landing.html`, "utf8").replaceAll("__ORIGIN__", esc(origin)));
  });

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

  /** The buyer's own orders (Telegram identity required). */
  app.get("/api/my-orders", (req, res) => {
    const shop = getShopBySlug(String(req.query.slug ?? ""));
    const user = validateInitData(req.get("x-tg-init") ?? undefined, process.env.BOT_TOKEN);
    if (!shop || !user) return void res.json({ auth: false, orders: [] });
    res.json({
      auth: true,
      orders: listBuyerOrders(shop.id, user.id).map((o) => ({
        id: o.id, status: o.status, total: o.total, discount: o.discount, delivery: o.delivery, created_at: o.created_at, items: getOrderItems(o.id),
      })),
    });
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

  /** Remembers a Mini App visitor (verified Telegram identity only) so the seller can reach them later. */
  app.post("/api/visit", (req, res) => {
    const shop = getShopBySlug(String(req.body?.slug ?? ""));
    const user = validateInitData(req.get("x-tg-init") ?? undefined, process.env.BOT_TOKEN);
    if (shop && user) upsertBuyer(shop.id, user.id, user.name, user.canWrite);
    res.json({ ok: !!(shop && user) });
  });

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
    if (buyer) upsertBuyer(shop.id, buyer.id, buyer.name, buyer.canWrite);
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

  // ---------------- seller panel API (Telegram-authenticated owner/managers only) ----------------
  app.get("/admin", (_req, res) => void res.type("html").send(readFileSync(`${WEB_DIR}admin.html`, "utf8")));

  const admin = express.Router();
  admin.use((req, res, next) => {
    const user = validateInitData(req.get("x-tg-init") ?? undefined, process.env.BOT_TOKEN);
    const shop = user ? findShopForUser(user.id) : undefined;
    if (!shop) return void res.status(401).json({ error: "unauthorized" });
    res.locals.shop = shop;
    next();
  });

  const adminProduct = (p: Product) => ({
    id: p.id,
    category: p.category,
    price: p.price,
    oldPrice: p.old_price,
    currency: p.currency,
    photo: p.photos[0] ? `/photos/${p.photos[0]}` : null,
    stock: p.stock,
    soldOut: isSoldOut(p),
    translations: p.translations,
    attributes: p.attributes,
  });
  const adminOrder = (o: Order) => ({ ...o, items: getOrderItems(o.id) });

  admin.get("/overview", (_req, res) => {
    const shop: Shop = res.locals.shop;
    const products = listProducts(shop.id);
    const orders = listOrders(shop.id, 200);
    res.json({
      shop: { name: shop.name, slug: shop.slug },
      url: process.env.MINIAPP_SHORTNAME
        ? `https://t.me/${process.env.BOT_USERNAME ?? "savia_shop_bot"}/${process.env.MINIAPP_SHORTNAME}?startapp=${shop.slug}`
        : `${(process.env.PUBLIC_URL ?? `https://${process.env.RAILWAY_PUBLIC_DOMAIN ?? "localhost:3000"}`).replace(/\/$/, "")}/s/${shop.slug}`,
      setup: {
        products: products.length > 0,
        contact: !!(shop.contact || shopPhones(shop).length),
        payment: !!shop.payment,
        about: !!shop.about,
        channel: shop.channel_id != null,
      },
      stats: {
        products: products.length,
        ordersNew: orders.filter((o) => o.status === "new").length,
        ordersTotal: orders.length,
        buyers: buyerCounts(shop.id),
      },
      low: products
        .filter((p) => p.stock && Object.values(p.stock).some((q) => q <= 2))
        .slice(0, 10)
        .map((p) => ({ id: p.id, title: p.translations.uz.title, stock: p.stock })),
    });
  });

  admin.get("/products", (_req, res) => {
    const shop: Shop = res.locals.shop;
    res.json({ products: listProducts(shop.id).map(adminProduct), categories: shopCategories(shop.id) });
  });

  admin.post("/products/:id", (req, res) => {
    const shop: Shop = res.locals.shop;
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const p = getProduct(id);
    if (!p || p.shop_id !== shop.id) return void res.status(404).json({ error: "not found" });
    if ("price" in b && b.price !== null && !(Number.isFinite(b.price) && b.price >= 0 && b.price <= 1e10)) return void res.status(400).json({ error: "bad price" });
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
    const translations: Record<string, { title?: string; description?: string }> = {};
    for (const l of LANGS) {
      const t = b.translations?.[l];
      if (!t) continue;
      translations[l] = { title: text(t.title, 120) || undefined, description: text(t.description, 600) };
    }
    updateProduct(id, shop.id, {
      ...("price" in b ? { price: b.price } : {}),
      ...(typeof b.category === "string" ? { category: b.category } : {}),
      translations,
    });
    if ("discount" in b) {
      if (b.discount === null) setDiscount(id, shop.id, null);
      else if (Number.isInteger(b.discount) && b.discount >= 1 && b.discount <= 90) setDiscount(id, shop.id, b.discount);
      else return void res.status(400).json({ error: "bad discount" });
    }
    if ("stock" in b) {
      let stock: Record<string, number> | null = null;
      if (b.stock !== null) {
        const entries = Object.entries(b.stock ?? {});
        if (!entries.length || entries.length > 30 || entries.some(([k, q]) => !k || k.length > 12 || !Number.isInteger(q) || (q as number) < 0 || (q as number) > 999999)) {
          return void res.status(400).json({ error: "bad stock" });
        }
        stock = Object.fromEntries(entries) as Record<string, number>;
      }
      setStock(id, shop.id, stock);
    }
    hooks.onProductChanged?.(shop, id);
    res.json({ product: adminProduct(getProduct(id)!) });
  });

  admin.delete("/products/:id", (req, res) => {
    const shop: Shop = res.locals.shop;
    res.json({ ok: deleteProduct(Number(req.params.id), shop.id) });
  });

  admin.get("/orders", (_req, res) => {
    const shop: Shop = res.locals.shop;
    res.json({ orders: listOrders(shop.id, 100).map(adminOrder) });
  });

  admin.post("/orders/:id/status", (req, res) => {
    const shop: Shop = res.locals.shop;
    const status = req.body?.status as OrderStatus;
    if (!["confirmed", "shipped", "cancelled"].includes(status)) return void res.status(400).json({ error: "bad status" });
    const id = Number(req.params.id);
    if (!setOrderStatus(id, shop.id, status)) return void res.status(404).json({ error: "not found" });
    const order = getOrder(id)!;
    hooks.onOrderStatus?.(shop, order, status);
    res.json({ order: adminOrder(order) });
  });

  admin.get("/settings", (_req, res) => {
    const shop: Shop = res.locals.shop;
    res.json({
      settings: {
        name: shop.name, about: shop.about, contact: shop.contact, payment: shop.payment, address: shop.address,
        phones: shopPhones(shop), minOrder: shop.min_order, deliveryFee: shop.delivery_fee, freeFrom: shop.free_from, accent: shop.accent,
      },
      promos: listPromos(shop.id),
    });
  });

  admin.post("/settings", (req, res) => {
    const shop: Shop = res.locals.shop;
    const b = req.body ?? {};
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
    const n = (v: unknown) => (Number.isFinite(v) && (v as number) >= 0 && (v as number) <= 1e10 ? (v as number) : undefined);
    const name = s(b.name, 60);
    if (name === "") return void res.status(400).json({ error: "name required" });
    const phones = Array.isArray(b.phones) ? b.phones.map((p: unknown) => s(p, 20)).filter(Boolean).slice(0, 3) : undefined;
    updateShop(shop.id, {
      ...(name !== undefined ? { name } : {}),
      ...(s(b.about, 300) !== undefined ? { about: s(b.about, 300)! } : {}),
      ...(s(b.contact, 80) !== undefined ? { contact: s(b.contact, 80)! } : {}),
      ...(s(b.payment, 200) !== undefined ? { payment: s(b.payment, 200)! } : {}),
      ...(s(b.address, 200) !== undefined ? { address: s(b.address, 200)! } : {}),
      ...(phones ? { phones: JSON.stringify(phones) } : {}),
      ...(n(b.minOrder) !== undefined ? { min_order: n(b.minOrder)! } : {}),
      ...(n(b.deliveryFee) !== undefined ? { delivery_fee: n(b.deliveryFee)! } : {}),
      ...(n(b.freeFrom) !== undefined ? { free_from: n(b.freeFrom)! } : {}),
      ...(typeof b.accent === "string" && /^(#[0-9a-fA-F]{6})?$/.test(b.accent) ? { accent: b.accent.toLowerCase() } : {}),
    });
    res.json({ ok: true });
  });

  admin.post("/promos", (req, res) => {
    const shop: Shop = res.locals.shop;
    const code = String(req.body?.code ?? "").trim();
    const percent = Number(req.body?.percent);
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(code) || !Number.isInteger(percent) || percent < 1 || percent > 90) return void res.status(400).json({ error: "bad promo" });
    savePromo(shop.id, code, percent);
    res.json({ promos: listPromos(shop.id) });
  });

  admin.post("/promos/:code/off", (req, res) => {
    const shop: Shop = res.locals.shop;
    setPromoActive(shop.id, req.params.code, false);
    res.json({ promos: listPromos(shop.id) });
  });

  app.use("/api/admin", admin);

  return app;
}

/** Set by the bot: keeps channel buttons and buyer messages in step with panel actions. */
const hooks: {
  onProductChanged?: (shop: Shop, productId: number) => void;
  onOrderStatus?: (shop: Shop, order: Order, status: OrderStatus) => void;
} = {};
export const setAdminHooks = (h: typeof hooks) => void Object.assign(hooks, h);

/** Set by the bot so unanswered buyer questions reach the seller. */
let notifySeller: ((shop: Shop, product: Product, question: string) => void) | undefined;
let notifyStock: ((shop: Shop, productIds: number[]) => void) | undefined;
let notifyOrder: ((shop: Shop, order: Order) => void) | undefined;
export const setSellerNotifier = (fn: typeof notifySeller) => void (notifySeller = fn);
export const setStockNotifier = (fn: typeof notifyStock) => void (notifyStock = fn);
export const setOrderNotifier = (fn: typeof notifyOrder) => void (notifyOrder = fn);
