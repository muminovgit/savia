import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
process.env.ORDER_RATE_LIMIT = "1000";
process.env.BOT_TOKEN = "123:test-token";
process.env.DATA_DIR = `${process.env.TMPDIR ?? "/tmp"}/savia-smoke-${Date.now()}`;
const db = await import("./db.js");
const { generateProduct } = await import("./ai.js");
const { createServer, esc, validateInitData } = await import("./server.js");
const { enhance } = await import("./image.js");
const sharp = (await import("sharp")).default;

// --- DB + AI (mock) ---
const shop = db.getOrCreateShop(1, "Test Shop");
db.updateShop(shop.id, { contact: "@tester", delivery_fee: 25000, free_from: 500000, min_order: 100000, phones: JSON.stringify(["+998901112233"]) });
const g = await generateProduct({ text: "qizil ko'ylak 180000 so'm" });
const mk = (extra: Partial<Parameters<typeof db.addProduct>[0]> = {}, src?: { chat: number; msg: number }) =>
  db.addProduct({ shop_id: shop.id, category: g.category, price: g.price, currency: g.currency, attributes: g.attributes, translations: g.translations, photos: [], ...extra }, src);
const p = mk();
assert.equal(p.price, 180000);

// --- image enhance ---
const raw = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#884422" } }).png().toBuffer();
const out = await sharp(await enhance(raw)).metadata();
assert.equal(out.format, "jpeg");
assert.ok(out.width! <= 1600);

const srv = createServer().listen(0);
const base = `http://localhost:${(srv.address() as any).port}`;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

// --- shop API + Mini App shell ---
const api = await (await fetch(`${base}/api/shop/${shop.slug}`)).json();
assert.equal(api.shop.name, "Test Shop");
assert.equal(api.shop.deliveryFee, 25000);
assert.equal(api.products.length, 1);
assert.equal((await fetch(`${base}/api/shop/nope`)).status, 404);
const shell = await (await fetch(`${base}/s/${shop.slug}`)).text();
assert.match(shell, new RegExp(`data-slug="${shop.slug}"`));
assert.equal((await fetch(`${base}/s/nope`)).status, 404);
assert.equal((await fetch(`${base}/static/app.js`)).status, 200);
assert.equal(esc(`<script>"'`), "&lt;script&gt;&quot;&#39;");

// --- chat ---
assert.ok((await (await post("/api/chat", { productId: p.id, lang: "uz", question: "razmeri bormi?" })).json()).answer);

// --- pricing: delivery, min order, promo ---
db.savePromo(shop.id, "yoz10", 10);
const quoteOf = async (qty: number, promo = "") => (await (await post("/api/quote", { slug: shop.slug, items: [{ id: p.id, qty }], promo })).json());
let q = await quoteOf(1);
assert.equal(q.subtotal, 180000);
assert.equal(q.delivery, 25000);
assert.equal(q.total, 205000);
q = await quoteOf(3, "YOZ10"); // 540 000 - 10% = 486 000, below free_from => delivery still charged
assert.equal(q.discount, 54000);
assert.equal(q.total, 486000 + 25000);
q = await quoteOf(4); // 720 000 >= free_from => free delivery
assert.equal(q.delivery, 0);
assert.equal((await quoteOf(1, "WRONG")).promoOk, false);

const order = (items: unknown, extra: object = {}, headers: Record<string, string> = {}) =>
  post("/api/orders", { slug: shop.slug, items, name: "Ali", phone: "+998901234567", address: "Toshkent", ...extra }, headers);

// min order: 1 x 50 000 item would be below 100 000
const cheap = mk({ price: 50000 });
assert.equal((await order([{ id: cheap.id, qty: 1 }])).status, 400);

// --- order + Telegram identity ---
const initData = (user: object) => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user), query_id: "q1" });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN!).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
};
assert.equal(validateInitData(initData({ id: 42, first_name: "Ali" }), process.env.BOT_TOKEN)!.id, 42);
assert.equal(validateInitData(initData({ id: 42 }).replace("42", "43"), process.env.BOT_TOKEN), null);
const ok = await (await order([{ id: p.id, qty: 2 }], { promo: "yoz10" }, { "x-tg-init": initData({ id: 777, first_name: "Ali" }) })).json();
assert.ok(ok.id);
const saved = db.getOrder(ok.id)!;
assert.equal(saved.buyer_tg_id, 777);
assert.match(saved.discount, /YOZ10/);
assert.equal(db.getOrderItems(ok.id)[0].qty, 2);
assert.equal((await order([{ id: 99999, qty: 1 }])).status, 400);
assert.equal(db.listPromos(shop.id)[0].uses, 1);
// forged identity is ignored
const forged = await (await order([{ id: p.id, qty: 1 }], {}, { "x-tg-init": "user=%7B%22id%22%3A1%7D&hash=00" })).json();
assert.equal(db.getOrder(forged.id)!.buyer_tg_id, null);

// --- discounts, categories ---
assert.ok(db.setDiscount(p.id, shop.id, 20));
assert.equal(db.getProduct(p.id)!.price, 144000);
assert.equal(db.getProduct(p.id)!.old_price, 180000);
assert.ok(db.setDiscount(p.id, shop.id, null));
assert.equal(db.getProduct(p.id)!.price, 180000);
db.setCategory(p.id, shop.id, "Kurtkalar");
assert.ok(db.shopCategories(shop.id).includes("Kurtkalar"));

// --- channel import bookkeeping ---
db.setShopChannel(shop.id, -1001234567890);
assert.equal(db.getShopByChannel(-1001234567890)!.id, shop.id);
const ch = mk({}, { chat: -1001234567890, msg: 7 });
assert.equal(db.productBySource(-1001234567890, 7)!.id, ch.id);
assert.throws(() => mk({}, { chat: -1001234567890, msg: 7 }));

// --- stock ---
const sp = mk({ price: 200000 });
db.setStock(sp.id, shop.id, { "46": 2, "48": 0 });
assert.equal((await order([{ id: sp.id, qty: 1 }])).status, 400); // size required
assert.equal((await order([{ id: sp.id, qty: 1, size: "48" }])).status, 409);
assert.equal((await (await order([{ id: sp.id, qty: 3, size: "46" }])).json()).have, 2);
const s1 = await (await order([{ id: sp.id, qty: 2, size: "46" }])).json();
assert.equal(db.getProduct(sp.id)!.stock!["46"], 0);
assert.ok(db.isSoldOut(db.getProduct(sp.id)!));
assert.equal((await (await fetch(`${base}/api/shop/${shop.slug}`)).json()).products.find((x: any) => x.id === sp.id).soldOut, true);
db.setOrderStatus(s1.id, shop.id, "cancelled");
assert.equal(db.getProduct(sp.id)!.stock!["46"], 2);
db.setStock(sp.id, shop.id, { _: 1 });
assert.equal((await order([{ id: sp.id, qty: 2 }])).status, 409);
assert.equal((await order([{ id: sp.id, qty: 1 }])).status, 200);

// --- admins / invites ---
const token = db.createInvite(shop.id);
assert.equal(db.acceptInvite(token, 555)!.id, shop.id);
assert.equal(db.acceptInvite(token, 556), undefined); // single use
assert.deepEqual(db.shopAdminIds(shop), [1, 555]);
assert.equal(db.getOrCreateShop(555, "Manager").id, shop.id);
assert.ok(db.removeAdmin(shop.id, 555));

// --- buyers / visit ---
assert.deepEqual(await (await post("/api/visit", { slug: shop.slug }, { "x-tg-init": initData({ id: 901, first_name: "Vali", allows_write_to_pm: true }) })).json(), { ok: true });
assert.deepEqual(await (await post("/api/visit", { slug: shop.slug }, { "x-tg-init": "hash=00" })).json(), { ok: false });
await post("/api/visit", { slug: shop.slug }, { "x-tg-init": initData({ id: 902, first_name: "Sardor" }) }); // opened, but did not allow messages
db.upsertBuyer(shop.id, 903, "Bot user", true);
assert.deepEqual(db.broadcastTargets(shop.id).sort(), [901, 903]);
db.markBuyerBlocked(shop.id, 903);
assert.deepEqual(db.broadcastTargets(shop.id), [901]);
db.upsertBuyer(shop.id, 903, "", true); // started the bot again
assert.equal(db.broadcastTargets(shop.id).length, 2);
assert.equal(db.broadcastsToday(shop.id), 0);
db.logBroadcast(shop.id, 2, 0);
assert.equal(db.broadcastsToday(shop.id), 1);

// --- seller panel API ---
const owner = { "x-tg-init": initData({ id: 1, first_name: "Owner" }) };
const stranger = { "x-tg-init": initData({ id: 424242, first_name: "Nobody" }) };
const adm = (path: string, method = "GET", body?: unknown, h: Record<string, string> = owner) =>
  fetch(`${base}/api/admin${path}`, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : JSON.stringify(body) });
assert.equal((await adm("/overview", "GET", undefined, {})).status, 401);
assert.equal((await adm("/overview", "GET", undefined, stranger)).status, 401);
const ov = await (await adm("/overview")).json();
assert.equal(ov.shop.slug, shop.slug);
assert.ok(ov.stats.products >= 1);
const plist = (await (await adm("/products")).json()).products;
const target = plist.find((x: any) => x.id === p.id);
assert.equal(target.translations.uz.title, g.translations.uz.title);
// edit: price, category, only the uz title (ru/en must stay intact), stock
const edited = await (await adm(`/products/${p.id}`, "POST", { price: 200000, category: "Yangi", translations: { uz: { title: "Yangi nom", description: "d" }, ru: {}, en: { title: "" } }, stock: { "46": 4 } })).json();
assert.equal(edited.product.price, 200000);
assert.equal(edited.product.translations.uz.title, "Yangi nom");
assert.equal(edited.product.translations.ru.title, g.translations.ru.title);
assert.equal(edited.product.translations.en.title, g.translations.en.title); // empty title is ignored, not blanked
assert.deepEqual(edited.product.stock, { "46": 4 });
assert.equal((await adm(`/products/${p.id}`, "POST", { price: -5 })).status, 400);
assert.equal((await adm(`/products/${p.id}`, "POST", { discount: 95 })).status, 400);
assert.equal((await adm(`/products/${p.id}`, "POST", { stock: { "46": -1 } })).status, 400);
const disc = await (await adm(`/products/${p.id}`, "POST", { discount: 10 })).json();
assert.equal(disc.product.price, 180000);
assert.equal(disc.product.oldPrice, 200000);
assert.equal((await (await adm(`/products/${p.id}`, "POST", { price: 150000 })).json()).product.oldPrice, null); // manual price clears the discount
assert.equal((await adm(`/products/${sp.id}`, "POST", { category: "x" }, stranger)).status, 401);
// orders
const olist = (await (await adm("/orders")).json()).orders;
assert.ok(olist.length >= 1 && Array.isArray(olist[0].items));
const newest = olist.find((o: any) => o.status === "new");
assert.equal((await (await adm(`/orders/${newest.id}/status`, "POST", { status: "confirmed" })).json()).order.status, "confirmed");
assert.equal((await adm(`/orders/${newest.id}/status`, "POST", { status: "bogus" })).status, 400);
// settings + promos
await adm("/settings", "POST", { name: "Yangi do'kon", phones: ["+998900000000", ""], deliveryFee: 30000, minOrder: 0 });
const set = (await (await adm("/settings")).json()).settings;
assert.equal(set.name, "Yangi do'kon");
assert.deepEqual(set.phones, ["+998900000000"]);
assert.equal(set.deliveryFee, 30000);
assert.equal((await adm("/settings", "POST", { name: "" })).status, 400);
assert.equal((await adm("/promos", "POST", { code: "KUZ15", percent: 15 })).status, 200);
assert.equal((await adm("/promos", "POST", { code: "x", percent: 15 })).status, 400);
const off = await (await adm("/promos/KUZ15/off", "POST", {})).json();
assert.equal(off.promos.find((x: any) => x.code === "KUZ15").active, 0);
assert.equal((await adm(`/products/${cheap.id}`, "DELETE")).status, 200);
assert.equal(db.getProduct(cheap.id), undefined);
assert.equal((await fetch(`${base}/admin`)).status, 200);

// --- demo shop ---
const { seedDemo } = await import("./demo.js");
seedDemo();
seedDemo(); // idempotent
const demo = await (await fetch(`${base}/api/shop/demo`)).json();
assert.equal(demo.products.length, 4);
assert.ok(demo.products.every((x: any) => x.photos.length === 1));
assert.equal((await fetch(`${base}${demo.products[0].photos[0]}`)).status, 200);
assert.ok(demo.products.some((x: any) => x.oldPrice));
assert.equal((await (await post("/api/quote", { slug: "demo", items: [{ id: demo.products[0].id, qty: 1, size: "46" }], promo: "DEMO10" })).json()).promoOk, true);

// --- landing ---
const land = await (await fetch(`${base}/`)).text();
assert.match(land, /Savia/);
assert.match(land, new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/static/landing/og.jpg`));
assert.equal((await fetch(`${base}/static/landing/catalog.jpg`)).status, 200);

// --- design update: resized images, accent colour, buyer order history, panel setup flags ---
const { writeFileSync } = await import("node:fs");
writeFileSync(`${process.env.DATA_DIR}/photos/t-photo.jpg`, await sharp({ create: { width: 2000, height: 1600, channels: 3, background: "#336699" } }).jpeg().toBuffer());
const small = await fetch(`${base}/img/t-photo.jpg?w=480`);
assert.equal(small.status, 200);
assert.equal(small.headers.get("content-type"), "image/jpeg");
assert.equal((await sharp(Buffer.from(await small.arrayBuffer())).metadata()).width, 480);
assert.equal((await sharp(Buffer.from(await (await fetch(`${base}/img/t-photo.jpg?w=9999`)).arrayBuffer())).metadata()).width, 1200);
assert.equal((await fetch(`${base}/img/nope.jpg`)).status, 404);
assert.equal((await fetch(`${base}/img/..%2F..%2Fetc%2Fpasswd`)).status, 404);
assert.equal((await fetch(`${base}/img/t-photo.orig`)).status, 404);

assert.equal((await adm("/settings", "POST", { accent: "#2563eb" })).status, 200);
assert.equal((await (await adm("/settings")).json()).settings.accent, "#2563eb");
await adm("/settings", "POST", { accent: "javascript:alert(1)" }); // invalid colours are ignored
assert.equal((await (await adm("/settings")).json()).settings.accent, "#2563eb");
assert.equal((await (await fetch(`${base}/api/shop/${shop.slug}`)).json()).shop.accent, "#2563eb");
await adm("/settings", "POST", { accent: "" });
assert.equal((await (await adm("/settings")).json()).settings.accent, "");

const mine = await (await fetch(`${base}/api/my-orders?slug=${shop.slug}`, { headers: { "x-tg-init": initData({ id: 777, first_name: "Ali" }) } })).json();
assert.equal(mine.auth, true);
assert.ok(mine.orders.length >= 1 && mine.orders.every((o: any) => Array.isArray(o.items)));
assert.deepEqual(await (await fetch(`${base}/api/my-orders?slug=${shop.slug}`)).json(), { auth: false, orders: [] });
const otherBuyer = await (await fetch(`${base}/api/my-orders?slug=${shop.slug}`, { headers: { "x-tg-init": initData({ id: 31337, first_name: "Eve" }) } })).json();
assert.equal(otherBuyer.orders.length, 0); // buyers only see their own orders
assert.equal((await (await adm("/overview")).json()).setup.products, true);
for (const f of ["ds.css", "ds.js", "shop.css", "panel.css", "admin.js"]) assert.equal((await fetch(`${base}/static/${f}`)).status, 200);

srv.close();
console.log("smoke ok");
