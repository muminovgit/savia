import assert from "node:assert/strict";
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
srv.close();
console.log("smoke ok");
