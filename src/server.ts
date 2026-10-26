import express from "express";
import { DATA_DIR, LANGS, createOrder, getProduct, getShopById, getShopBySlug, listProducts, logQuestion } from "./db.js";
import type { Lang, Order, Product, Shop } from "./db.js";
import { answerQuestion } from "./ai.js";

const UI: Record<Lang, Record<string, string>> = {
  uz: { ask: "Savol bering", send: "Yuborish", contact: "Sotuvchiga yozish", empty: "Hozircha mahsulot yo'q", hint: "Masalan: razmeri bormi?", back: "Katalog", price: "Narxi", agree: "Narxi kelishiladi",
    add: "Savatga qo'shish", added: "Savatga qo'shildi ✓", cart: "Savat", cartEmpty: "Savat bo'sh", total: "Jami", checkout: "Buyurtma berish", name: "Ismingiz", phone: "Telefon raqamingiz", address: "Yetkazish manzili", note: "Izoh (ixtiyoriy)", sending: "Yuborilmoqda...", placed: "Buyurtma qabul qilindi", thanks: "Sotuvchi tez orada siz bilan bog'lanadi.", pay: "To'lov ma'lumoti", remove: "O'chirish", error: "Xatolik, qayta urinib ko'ring", orderNo: "Buyurtma raqami" },
  ru: { ask: "Задайте вопрос", send: "Отправить", contact: "Написать продавцу", empty: "Товаров пока нет", hint: "Например: есть ли размер?", back: "Каталог", price: "Цена", agree: "Цена договорная",
    add: "В корзину", added: "Добавлено ✓", cart: "Корзина", cartEmpty: "Корзина пуста", total: "Итого", checkout: "Оформить заказ", name: "Ваше имя", phone: "Ваш телефон", address: "Адрес доставки", note: "Комментарий (необязательно)", sending: "Отправка...", placed: "Заказ принят", thanks: "Продавец скоро свяжется с вами.", pay: "Данные для оплаты", remove: "Удалить", error: "Ошибка, попробуйте снова", orderNo: "Номер заказа" },
  en: { ask: "Ask a question", send: "Send", contact: "Message the seller", empty: "No products yet", hint: "e.g. is it available in size M?", back: "Catalog", price: "Price", agree: "Price on request",
    add: "Add to cart", added: "Added ✓", cart: "Cart", cartEmpty: "Your cart is empty", total: "Total", checkout: "Place order", name: "Your name", phone: "Your phone", address: "Delivery address", note: "Note (optional)", sending: "Sending...", placed: "Order received", thanks: "The seller will contact you soon.", pay: "Payment details", remove: "Remove", error: "Something went wrong, try again", orderNo: "Order number" },
};

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const js = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

const asLang = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : "uz");

const priceText = (p: Product, l: Lang) =>
  p.price == null ? UI[l].agree : `${new Intl.NumberFormat("ru-RU").format(p.price)} ${p.currency}`;

const contactHref = (c: string) => {
  const v = c.trim();
  if (/^@\w+$/.test(v)) return `https://t.me/${v.slice(1)}`;
  if (/^\+?[\d\s()-]{7,}$/.test(v)) return `tel:${v.replace(/[^\d+]/g, "")}`;
  return /^https?:\/\//.test(v) ? v : "";
};

const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#f6f6f7;color:#1a1a1a}
header{background:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;position:sticky;top:0}
header a{color:inherit;text-decoration:none;font-weight:700}.langs a{margin-left:8px;font-weight:400;color:#666}
main{max-width:960px;margin:0 auto;padding:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.card{background:#fff;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;display:block}
.card img,.ph{width:100%;aspect-ratio:1;object-fit:cover;background:#e8e8ea;display:block}.card div{padding:10px}
.price{font-weight:700;margin-top:4px}.detail{background:#fff;border-radius:12px;overflow:hidden}.detail .in{padding:16px}
.attrs{color:#555;font-size:14px}.btn{display:inline-block;background:#1a1a1a;color:#fff;border:0;border-radius:8px;padding:10px 14px;text-decoration:none;cursor:pointer;font-size:15px}
#log{margin:12px 0;display:flex;flex-direction:column;gap:8px}.m{padding:8px 12px;border-radius:12px;max-width:85%}
.u{background:#1a1a1a;color:#fff;align-self:flex-end}.a{background:#eee}form{display:flex;gap:8px}form.col{flex-direction:column}.ci{display:flex;gap:10px;align-items:center;background:#fff;border-radius:12px;padding:8px;margin-bottom:8px}.ci img{width:64px;height:64px;object-fit:cover;border-radius:8px}.ci .t{flex:1}.ci button{border:0;background:#eee;border-radius:6px;padding:4px 10px;cursor:pointer}.ok{background:#fff;border-radius:12px;padding:16px}textarea{padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px;font-family:inherit}input{flex:1;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px}
</style></head><body>${body}</body></html>`;

const header = (shop: Shop, lang: Lang, path: string) =>
  `<header><a href="/s/${esc(shop.slug)}?lang=${lang}">${esc(shop.name)}</a>
<span class="langs"><a href="/s/${esc(shop.slug)}/cart?lang=${lang}">🛒 <span id="cc">0</span></a>${LANGS.map((l) => `<a href="${path}?lang=${l}">${l.toUpperCase()}</a>`).join("")}</span></header>
<script>try{const c=JSON.parse(localStorage.getItem('c:'+${js(shop.slug)})||'[]');document.getElementById('cc').textContent=c.reduce((n,i)=>n+i.qty,0)}catch{}</script>`;

export function createServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "10kb" }));
  app.use("/photos", express.static(`${DATA_DIR}/photos`, { maxAge: "1d" }));

  app.get("/healthz", (_req, res) => void res.json({ ok: true }));

  app.get("/s/:slug", (req, res) => {
    const shop = getShopBySlug(req.params.slug);
    if (!shop) return void res.status(404).send("Not found");
    const lang = asLang(req.query.lang);
    const items = listProducts(shop.id);
    const cards = items
      .map((p) => {
        const t = p.translations[lang];
        const img = p.photos[0] ? `<img loading="lazy" src="/photos/${esc(p.photos[0])}" alt="">` : `<div class="ph"></div>`;
        return `<a class="card" href="/s/${esc(shop.slug)}/p/${p.id}?lang=${lang}">${img}<div>${esc(t.title)}<div class="price">${esc(priceText(p, lang))}</div></div></a>`;
      })
      .join("");
    res.send(
      page(shop.name, `${header(shop, lang, `/s/${esc(shop.slug)}`)}<main>${items.length ? `<div class="grid">${cards}</div>` : `<p>${UI[lang].empty}</p>`}</main>`),
    );
  });

  app.get("/s/:slug/p/:id", (req, res) => {
    const shop = getShopBySlug(req.params.slug);
    const product = getProduct(Number(req.params.id));
    if (!shop || !product || product.shop_id !== shop.id) return void res.status(404).send("Not found");
    const lang = asLang(req.query.lang);
    const t = product.translations[lang];
    const ui = UI[lang];
    const attrs = Object.entries(product.attributes).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ");
    const href = contactHref(shop.contact);
    const img = product.photos.map((f) => `<img src="/photos/${esc(f)}" alt="">`).join("");
    const body = `${header(shop, lang, `/s/${esc(shop.slug)}/p/${product.id}`)}<main>
<p><a href="/s/${esc(shop.slug)}?lang=${lang}">← ${ui.back}</a></p>
<div class="detail">${img}<div class="in"><h2>${esc(t.title)}</h2><div class="price">${esc(priceText(product, lang))}</div>
<p>${esc(t.description)}</p><p class="attrs">${attrs}</p>
<p><button class="btn" id="addc">${ui.add}</button></p>
${href ? `<p><a class="btn" href="${esc(href)}">${ui.contact}</a></p>` : ""}
<h3>${ui.ask}</h3><div id="log"></div>
<form id="f"><input id="q" maxlength="300" placeholder="${esc(ui.hint)}" required><button class="btn">${ui.send}</button></form></div></div></main>
<script>
const P=${js({ id: product.id, title: t.title, price: product.price, currency: product.currency, photo: product.photos[0] ?? null })};
document.getElementById('addc').onclick=e=>{const k='c:'+${js(shop.slug)};let c=[];try{c=JSON.parse(localStorage.getItem(k)||'[]')}catch{}
const x=c.find(i=>i.id===P.id);if(x)x.qty=Math.min(20,x.qty+1);else c.push({...P,qty:1});localStorage.setItem(k,JSON.stringify(c));
document.getElementById('cc').textContent=c.reduce((n,i)=>n+i.qty,0);e.target.textContent=${js(ui.added)}};
const log=document.getElementById('log');
function add(c,t){const d=document.createElement('div');d.className='m '+c;d.textContent=t;log.appendChild(d)}
document.getElementById('f').onsubmit=async e=>{e.preventDefault();const q=document.getElementById('q');const text=q.value.trim();if(!text)return;
add('u',text);q.value='';
try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:${product.id},lang:'${lang}',question:text})});
const j=await r.json();add('a',j.answer||'...')}catch{add('a','Error')}};
</script>`;
    res.send(page(`${t.title} — ${shop.name}`, body));
  });

  app.get("/s/:slug/cart", (req, res) => {
    const shop = getShopBySlug(req.params.slug);
    if (!shop) return void res.status(404).send("Not found");
    const lang = asLang(req.query.lang);
    const ui = UI[lang];
    const body = `${header(shop, lang, `/s/${esc(shop.slug)}/cart`)}<main>
<p><a href="/s/${esc(shop.slug)}?lang=${lang}">← ${ui.back}</a></p><h2>${ui.cart}</h2>
<div id="items"></div><p class="price" id="total"></p>
<form id="of" class="col" style="display:none">
<input id="n" name="name" maxlength="80" placeholder="${esc(ui.name)}" required>
<input id="p" name="phone" type="tel" maxlength="30" placeholder="${esc(ui.phone)}" required>
<input id="a" name="address" maxlength="200" placeholder="${esc(ui.address)}">
<textarea id="o" name="note" maxlength="300" rows="2" placeholder="${esc(ui.note)}"></textarea>
<button class="btn" id="go">${ui.checkout}</button></form>
<div class="ok" id="done" style="display:none"></div></main>
<script>
const K='c:'+${js(shop.slug)},U=${js(ui)};let c=[];try{c=JSON.parse(localStorage.getItem(K)||'[]')}catch{}
const fmt=n=>new Intl.NumberFormat('ru-RU').format(n);
function save(){localStorage.setItem(K,JSON.stringify(c));document.getElementById('cc').textContent=c.reduce((n,i)=>n+i.qty,0)}
function draw(){const box=document.getElementById('items');box.textContent='';
 if(!c.length){box.textContent=U.cartEmpty;document.getElementById('of').style.display='none';document.getElementById('total').textContent='';return}
 document.getElementById('of').style.display='flex';const tot={};
 c.forEach((i,idx)=>{const r=document.createElement('div');r.className='ci';
  if(i.photo){const im=document.createElement('img');im.src='/photos/'+i.photo;r.appendChild(im)}
  const t=document.createElement('div');t.className='t';t.textContent=i.title+(i.price!=null?' — '+fmt(i.price)+' '+i.currency:'');r.appendChild(t);
  const mk=(l,d)=>{const b=document.createElement('button');b.textContent=l;b.onclick=()=>{i.qty+=d;if(i.qty<1)c.splice(idx,1);if(i.qty>20)i.qty=20;save();draw()};return b};
  r.appendChild(mk('−',-1));const q=document.createElement('span');q.textContent=i.qty;r.appendChild(q);r.appendChild(mk('+',1));box.appendChild(r);
  if(i.price!=null)tot[i.currency]=(tot[i.currency]||0)+i.price*i.qty});
 const parts=Object.entries(tot).map(([k,v])=>fmt(v)+' '+k);document.getElementById('total').textContent=parts.length?U.total+': '+parts.join(' + '):''}
draw();
document.getElementById('of').onsubmit=async e=>{e.preventDefault();const b=document.getElementById('go');b.disabled=true;b.textContent=U.sending;
 try{const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:${js(shop.slug)},items:c.map(i=>({id:i.id,qty:i.qty})),
  name:n.value,phone:p.value,address:a.value,note:o.value})});const j=await r.json();
  if(!r.ok)throw new Error(j.error||'');
  c=[];save();document.getElementById('of').style.display='none';document.getElementById('items').textContent='';document.getElementById('total').textContent='';
  const d=document.getElementById('done');d.style.display='block';d.textContent='';
  const h=document.createElement('h3');h.textContent='✓ '+U.placed+' — '+U.orderNo+': #'+j.id;d.appendChild(h);
  const p1=document.createElement('p');p1.textContent=U.thanks;d.appendChild(p1);
  if(j.payment){const p2=document.createElement('p');p2.textContent=U.pay+': '+j.payment;d.appendChild(p2)}
 }catch(err){b.disabled=false;b.textContent=U.checkout;alert(U.error)}};
</script>`;
    res.send(page(`${ui.cart} — ${shop.name}`, body));
  });

  const hits = new Map<string, number[]>();
  const tooMany = (ip: string) => {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > 5;
  };

  app.post("/api/orders", (req, res) => {
    if (tooMany(req.ip ?? "")) return void res.status(429).json({ error: "too many requests" });
    const b = req.body ?? {};
    const shop = getShopBySlug(String(b.slug ?? ""));
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const name = str(b.name, 80);
    const phone = str(b.phone, 30);
    const digits = phone.replace(/\D/g, "");
    if (!shop || !name || digits.length < 7 || digits.length > 15 || !Array.isArray(b.items) || !b.items.length || b.items.length > 30) {
      return void res.status(400).json({ error: "bad request" });
    }
    const merged = new Map<number, number>();
    for (const it of b.items) {
      const id = Number(it?.id);
      const qty = Number(it?.qty);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20) return void res.status(400).json({ error: "bad item" });
      merged.set(id, Math.min(20, (merged.get(id) ?? 0) + qty));
    }
    const items: { product: Product; qty: number }[] = [];
    for (const [id, qty] of merged) {
      const product = getProduct(id);
      if (!product || product.shop_id !== shop.id) return void res.status(400).json({ error: "bad item" });
      items.push({ product, qty });
    }
    const order = createOrder(shop.id, { name, phone, address: str(b.address, 200), note: str(b.note, 300) }, items);
    notifyOrder?.(shop, order);
    res.json({ id: order.id, payment: shop.payment, contact: shop.contact });
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
let notifyOrder: ((shop: Shop, order: Order) => void) | undefined;
export const setOrderNotifier = (fn: typeof notifyOrder) => void (notifyOrder = fn);
export const setSellerNotifier = (fn: typeof notifySeller) => void (notifySeller = fn);
