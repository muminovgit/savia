import assert from "node:assert/strict";
process.env.ORDER_RATE_LIMIT = "1000";
process.env.DATA_DIR = `${process.env.TMPDIR ?? "/tmp"}/savia-smoke-${Date.now()}`;
const { addProduct, getOrCreateShop, updateShop } = await import("./db.js");
const { generateProduct } = await import("./ai.js");
const { createServer, esc } = await import("./server.js");

const shop = getOrCreateShop(1, "Test Shop");
updateShop(shop.id, { contact: "@tester" });
const g = await generateProduct({ text: "qizil ko'ylak 180000 so'm" });
const p = addProduct({ shop_id: shop.id, category: g.category, price: g.price, currency: g.currency, attributes: g.attributes, translations: g.translations, photos: [] });
assert.equal(p.price, 180000);

const { enhance } = await import("./image.js");
const sharp = (await import("sharp")).default;
const raw = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#884422" } }).png().toBuffer();
const out = await sharp(await enhance(raw)).metadata();
assert.equal(out.format, "jpeg");
assert.ok(out.width! <= 1600);

const srv = createServer().listen(0);
const base = `http://localhost:${(srv.address() as any).port}`;
const cat = await (await fetch(`${base}/s/${shop.slug}?lang=ru`)).text();
assert.match(cat, /qizil/);
const prod = await (await fetch(`${base}/s/${shop.slug}/p/${p.id}`)).text();
assert.match(prod, /t\.me\/tester/);
const chat = await (await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: p.id, lang: "uz", question: "razmeri bormi?" }) })).json();
assert.ok(chat.answer);
assert.equal((await fetch(`${base}/s/nope`)).status, 404);
assert.equal(esc(`<script>"'`), "&lt;script&gt;&quot;&#39;");
const ord = await (await fetch(`${base}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: shop.slug, items: [{ id: p.id, qty: 2 }], name: "Ali", phone: "+998901234567", address: "Toshkent" }) })).json();
assert.ok(ord.id);
const { getOrder, getOrderItems } = await import("./db.js");
assert.equal(getOrder(ord.id)!.total.replace(/\s/g, " "), "360 000 UZS");
assert.equal(getOrderItems(ord.id)[0].qty, 2);
const bad = await fetch(`${base}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: shop.slug, items: [{ id: 99999, qty: 1 }], name: "Ali", phone: "+998901234567" }) });
assert.equal(bad.status, 400);
assert.match(await (await fetch(`${base}/s/${shop.slug}/cart`)).text(), /Savat/);
const { setShopChannel, getShopByChannel, productBySource } = await import("./db.js");
setShopChannel(shop.id, -1001234567890);
assert.equal(getShopByChannel(-1001234567890)!.id, shop.id);
const p2 = addProduct({ shop_id: shop.id, category: "x", price: 1, currency: "UZS", attributes: { code: "MO1", size: "M" }, translations: g.translations, photos: [] }, { chat: -1001234567890, msg: 7 });
assert.equal(productBySource(-1001234567890, 7)!.id, p2.id);
assert.throws(() => addProduct({ shop_id: shop.id, category: "x", price: 1, currency: "UZS", attributes: {}, translations: g.translations, photos: [] }, { chat: -1001234567890, msg: 7 }));
assert.match(await (await fetch(`${base}/s/${shop.slug}`)).text(), /data-s="[^"]*mo1/);
// --- stock ---
const { setStock, getProduct, OutOfStock, setOrderStatus, isSoldOut } = await import("./db.js");
const sp = addProduct({ shop_id: shop.id, category: "x", price: 100, currency: "UZS", attributes: {}, translations: g.translations, photos: [] });
setStock(sp.id, shop.id, { "46": 2, "48": 0 });
const order = (size: string, qty: number) => fetch(`${base}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: shop.slug, items: [{ id: sp.id, qty, size }], name: "Ali", phone: "+998901234567" }) });
assert.equal((await order("", 1)).status, 400); // size required
assert.equal((await order("48", 1)).status, 409); // sold-out size
const r409 = await (await order("46", 3)).json();
assert.equal(r409.have, 2);
const okRes = await (await order("46", 2)).json();
assert.equal(getProduct(sp.id)!.stock!["46"], 0);
assert.ok(isSoldOut(getProduct(sp.id)!));
assert.match(await (await fetch(`${base}/s/${shop.slug}`)).text(), /Tugadi/);
setOrderStatus(okRes.id, shop.id, "cancelled");
assert.equal(getProduct(sp.id)!.stock!["46"], 2);
setStock(sp.id, shop.id, { _: 1 });
assert.equal((await order("", 2)).status, 409);
assert.equal((await order("", 1)).status, 200);
assert.ok(OutOfStock);
srv.close();
console.log("smoke ok");
