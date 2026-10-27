(() => {
  const { tg, $, $$, esc, fmt, icon, haptic, toast, sheet, closeLayer, confirmDialog, copy, initial, ago, accentVars } = DS;
  const app = $("#app"), cta = $("#cta"), tabs = $("#tabs");
  const thumb = (u, w) => (u ? u.replace("/photos/", "/img/") + "?w=" + w : "");
  const money = (n, c) => fmt(n) + (c ? " " + c : "");
  const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

  const api = async (path, method = "GET", body) => {
    const r = await fetch("/api/admin" + path, { method, headers: { "content-type": "application/json", "x-tg-init": (tg && tg.initData) || "" }, body: body === undefined ? undefined : JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch {}
    if (r.status === 401) throw new Error("auth");
    if (!r.ok) throw Object.assign(new Error(j.error || "error"), { code: j.error });
    return j;
  };

  const S = { dirty: false, F: null, orig: "", editId: null, pf: "all", of: "new", q: "", products: [], categories: [], orders: [], rt: 0, ov: null, settings: null };
  const STATUS = { new: "Yangi", confirmed: "Tasdiqlangan", shipped: "Yuborilgan", cancelled: "Bekor qilingan" };
  const STAT_CLS = { new: "soft", confirmed: "ok", shipped: "ok", cancelled: "bad" };

  // ------------------------------------------------------------------ navigation (own stack: every screen has a working back button)
  const stack = [];
  const curHash = () => location.hash || "#/";
  function route() {
    const [a, b] = curHash().replace(/^#\/?/, "").split("/");
    if (a === "products") return b ? { name: "product", id: Number(b) } : { name: "products" };
    if (a === "orders") return b ? { name: "order", id: Number(b) } : { name: "orders" };
    if (a === "settings") return b ? { name: "set-" + b } : { name: "settings" };
    return { name: "home" };
  }
  const tabOf = (n) => (n === "home" ? "home" : n.startsWith("product") ? "products" : n.startsWith("order") ? "orders" : "settings");
  function back() {
    if (stack.length > 1) stack.pop();
    const h = stack[stack.length - 1] || "#/";
    if (!stack.length) stack.push("#/");
    if (curHash() === h) render(); else location.replace(h);
  }
  async function leaveOk() {
    if (!S.dirty) return true;
    const ok = await confirmDialog({ title: "O'zgarishlar saqlanmadi", text: "Chiqsangiz, kiritganlaringiz yo'qoladi.", ok: "Chiqish", cancel: "Qolish", danger: true });
    if (ok) S.dirty = false;
    return ok;
  }
  window.addEventListener("hashchange", () => {
    const h = curHash(), top = stack[stack.length - 1];
    if (h !== top) { if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else stack.push(h); }
    render();
  });
  stack.push("#/"); if (curHash() !== "#/") stack.push(curHash());

  const topbar = (title, right = "", sub = "") => `<header class="topbar"><button class="ib" data-act="back" aria-label="Orqaga">${icon("back", 26)}</button><h1>${title}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</h1>${right}</header>`;
  const empty = (ic, ttl, sub, btn = "") => `<div class="empty"><div class="art">${icon(ic, 44)}</div><h2>${esc(ttl)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}${btn}</div>`;
  const openLink = (url) => { if (tg && tg.openTelegramLink && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url); else window.open(url, "_blank"); };
  const toBot = () => { if (tg && tg.close) tg.close(); else openLink("https://t.me/savia_shop_bot"); };

  // ------------------------------------------------------------------ helpers
  const stockInfo = (st) => { if (!st) return null; const q = Object.values(st); return { total: q.reduce((a, b) => a + b, 0), low: Object.entries(st).filter(([, v]) => v <= 2 && v > 0), out: q.every((v) => v <= 0) }; };
  const stockLabel = (st) => (st ? Object.entries(st).map(([k, v]) => (k === "_" ? `jami ${v}` : `${k}: ${v}`)).join(", ") : "");
  function stockTag(p) {
    if (!p.stock) return `<span class="badge gray">Qoldiq kuzatilmaydi</span>`;
    const i = stockInfo(p.stock);
    if (i.out) return `<span class="badge bad">Tugadi</span>`;
    if (i.low.length) return `<span class="badge warn">Kam: ${esc(i.low.map(([k, v]) => (k === "_" ? v : `${k}:${v}`)).join(", "))}</span>`;
    return `<span class="badge ok">Qoldiq: ${i.total}</span>`;
  }
  const priceLine = (p) => (p.price == null ? "Narx yo'q" : money(p.price, p.currency)) + (p.oldPrice ? `<s>${esc(fmt(p.oldPrice))}</s>` : "");
  const prow = (p) => `<a class="prow" href="#/products/${p.id}">${p.photo ? `<img loading="lazy" src="${esc(thumb(p.photo, 240))}" alt="">` : '<div class="noimg"></div>'}
<div class="t"><b>${esc(p.translations.uz.title)}</b><div class="m">${priceLine(p)}${p.category ? ` · ${esc(p.category)}` : ""}</div><div class="tags">${stockTag(p)}${p.oldPrice ? '<span class="badge sale">Chegirma</span>' : ""}</div></div>${icon("chev", 20)}</a>`;
  const orderSummary = (o) => { const f = o.items[0]; return f ? `${f.title}${f.size ? ` (${f.size})` : ""} × ${f.qty}${o.items.length > 1 ? ` va yana ${o.items.length - 1} ta` : ""}` : ""; };
  const ocard = (o, quick) => `<a class="card ocardp" href="#/orders/${o.id}"><div class="oh"><b>#${o.id} · ${esc(o.name)}</b><span class="badge ${STAT_CLS[o.status]}">${STATUS[o.status]}</span></div>
<div class="oi">${esc(ago(o.created_at))} · ${esc(o.phone)}</div><div class="oi">${esc(orderSummary(o))}</div>
<div class="of"><b>${esc(o.total)}</b>${quick && o.status === "new" ? `<button class="btn sm" data-act="ostatus" data-id="${o.id}" data-s="confirmed">${icon("check", 18)} Tasdiqlash</button>` : ""}</div></a>`;

  const addInfo = () => sheet({
    title: "Mahsulot qo'shish",
    html: `<div class="steps" style="padding:4px 4px 8px"><div class="s"><div class="n">1</div><div><b>Botga rasm yuboring</b><p class="muted small">Rasmning izohiga narx va razmerni yozing: <i>«Erkaklar kardigani, 540 000 so'm, razmer 46-52»</i>. AI nom, tavsif va 3 tilga tarjimani o'zi yozadi.</p></div></div>
<div class="s"><div class="n">2</div><div><b>Yoki kanalingizni ulang</b><p class="muted small">Kanalga qo'ygan har yangi post avtomatik mahsulotga aylanadi.</p></div></div>
<div class="s"><div class="n">3</div><div><b>Shu yerda tahrirlang</b><p class="muted small">Narx, chegirma va qoldiqni panelda o'zgartirasiz.</p></div></div></div>
<button class="btn block" data-act="tobot">${icon("send", 20)} Botga o'tish</button>`,
  });

  // ------------------------------------------------------------------ home
  async function viewHome() {
    const [ov, od] = await Promise.all([api("/overview"), api("/orders")]);
    S.ov = ov; S.orders = od.orders;
    const st = ov.setup, newOrders = od.orders.filter((o) => o.status === "new");
    const steps = [
      { done: st.products, t: "Birinchi mahsulotni qo'shing", s: "Botga rasm yuboring", act: 'data-act="addinfo"', tag: "button" },
      { done: st.channel, t: "Kanalingizni ulang", s: "Postlar avtomatik katalogga o'tadi", act: 'href="#/settings/more"', tag: "a" },
      { done: st.contact, t: "Aloqa ma'lumotini kiriting", s: "Telefon yoki @username", act: 'href="#/settings/shop"', tag: "a" },
      { done: st.payment, t: "To'lov ma'lumotini yozing", s: "Karta raqami yoki «naqd pul»", act: 'href="#/settings/payment"', tag: "a" },
      { done: st.about, t: "Do'kon tavsifini yozing", s: "Xaridor sizni tanishi uchun", act: 'href="#/settings/shop"', tag: "a" },
    ];
    const doneN = steps.filter((s) => s.done).length;
    return {
      html: `<div class="hello"><div class="avatar lg" style="width:52px;height:52px;border-radius:17px;font-size:23px">${esc(initial(ov.shop.name))}</div><div><h1>${esc(ov.shop.name)}</h1><p>Sotuvchi paneli</p></div></div>
${doneN < steps.length ? `<div class="section"><div class="card"><div class="progline"><div class="prog"><i style="width:${Math.round((doneN / steps.length) * 100)}%"></i></div><b>${doneN}/${steps.length}</b></div><h2 style="margin-bottom:4px">Do'koningizni sozlang</h2>
<div class="check">${steps.filter((s) => !s.done).map((s) => `<${s.tag} class="ci ${s.done ? "done" : ""}" ${s.act}><span class="cc">${icon("check", 16)}</span><span class="ct"><b>${esc(s.t)}</b><span>${esc(s.s)}</span></span>${s.done ? "" : icon("chev", 18)}</${s.tag}>`).join("")}</div></div></div>` : ""}
<div class="kpis"><a class="kpi ${ov.stats.ordersNew ? "hot" : ""}" href="#/orders"><span class="kic">${icon("receipt", 26)}</span><b>${ov.stats.ordersNew}</b><span>Yangi buyurtma</span></a>
<a class="kpi" href="#/products"><span class="kic">${icon("box", 26)}</span><b>${ov.stats.products}</b><span>Mahsulot</span></a>
<div class="kpi"><span class="kic">${icon("cart", 26)}</span><b>${ov.stats.ordersTotal}</b><span>Jami buyurtma</span></div>
<div class="kpi"><span class="kic">${icon("users", 26)}</span><b>${ov.stats.buyers.reachable || 0}<small style="font-size:15px;font-weight:600;color:var(--text-3)"> / ${ov.stats.buyers.total || 0}</small></b><span>Xaridor (xabar olishi mumkin)</span></div></div>
<div class="quick"><button class="qa" data-act="copylink"><span class="qi">${icon("link", 22)}</span>Linkni nusxalash</button><button class="qa" data-act="openshop"><span class="qi">${icon("store", 22)}</span>Do'konni ochish</button><button class="qa" data-act="addinfo"><span class="qi">${icon("plus", 22)}</span>Mahsulot qo'shish</button></div>
${newOrders.length ? `<div class="group-title">Yangi buyurtmalar</div><div style="margin:0 16px">${newOrders.slice(0, 3).map((o) => ocard(o, true)).join("")}${newOrders.length > 3 ? `<a class="btn ghost block" style="margin-top:12px" href="#/orders">Hammasini ko'rish (${newOrders.length})</a>` : ""}</div>` : ""}
${ov.low.length ? `<div class="group-title">Qoldiq kam</div><div class="list">${ov.low.map((p) => `<a class="row noicon" href="#/products/${p.id}"><span class="rt"><b>${esc(p.title)}</b><span>${esc(stockLabel(p.stock))}</span></span><span class="chev">${icon("chev", 18)}</span></a>`).join("")}</div>` : ""}`,
    };
  }

  // ------------------------------------------------------------------ products
  const loadProducts = async () => { const d = await api("/products"); S.products = d.products; S.categories = d.categories; };
  const pfilters = [["all", "Hammasi", () => true], ["out", "Tugagan", (p) => p.stock && stockInfo(p.stock).out], ["low", "Qoldiq kam", (p) => p.stock && stockInfo(p.stock).low.length], ["sale", "Chegirmali", (p) => p.oldPrice], ["free", "Qoldiqsiz", (p) => !p.stock]];
  function drawProducts() {
    const box = $("#plist"); if (!box) return;
    const q = S.q.trim().toLowerCase(), f = pfilters.find((x) => x[0] === S.pf) || pfilters[0];
    const items = S.products.filter((p) => f[2](p) && (!q || [p.translations.uz.title, p.translations.ru.title, p.category, ...Object.values(p.attributes)].join(" ").toLowerCase().includes(q)));
    box.innerHTML = items.length ? items.map(prow).join("") : empty("search", "Hech narsa topilmadi", "Qidiruv yoki filtrni o'zgartiring");
    $$("#pchips .chip").forEach((c) => c.classList.toggle("on", c.dataset.v === S.pf));
  }
  async function viewProducts() {
    await loadProducts();
    if (!S.products.length) return { html: `${topbar("Mahsulotlar")}${empty("box", "Hali mahsulot yo'q", "Botga rasm yuboring yoki kanalingizni ulang. Mahsulot shu yerda paydo bo'ladi.", `<button class="btn" data-act="addinfo">${icon("plus", 20)} Qanday qo'shaman?</button>`)}` };
    return {
      html: `${topbar("Mahsulotlar", `<button class="ib" data-act="addinfo" aria-label="Qo'shish">${icon("plus", 24)}</button>`, `${S.products.length} ta`)}
<div class="toolbar"><div class="searchbox">${icon("search", 20)}<input id="pq" type="search" placeholder="Qidirish" value="${esc(S.q)}" aria-label="Qidirish"></div>
<div class="chips" id="pchips">${pfilters.map(([k, l, fn]) => `<button class="chip ${S.pf === k ? "on" : ""}" data-act="pf" data-v="${k}">${l}<span class="n">${S.products.filter(fn).length}</span></button>`).join("")}</div></div>
<div class="prows" id="plist"></div>`,
      mount: drawProducts,
    };
  }

  // ------------------------------------------------------------------ product editor
  function initForm(p) {
    const st = p.stock, keys = st ? Object.keys(st) : [];
    const base = p.oldPrice != null ? p.oldPrice : p.price;
    S.F = {
      tu: p.translations.uz.title, du: p.translations.uz.description, tr: p.translations.ru.title, dr: p.translations.ru.description, te: p.translations.en.title, de: p.translations.en.description,
      base: base == null ? "" : String(base), pct: p.oldPrice && p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0, category: p.category || "",
      mode: !st ? "off" : keys.length === 1 && keys[0] === "_" ? "total" : "sizes", total: st && st._ != null ? st._ : 0,
      sizes: st && !(keys.length === 1 && keys[0] === "_") ? keys.map((k) => ({ s: k, q: st[k] })) : [],
    };
    S.orig = JSON.stringify(S.F); S.dirty = false; S.editId = p.id;
  }
  const markDirty = () => { S.dirty = JSON.stringify(S.F) !== S.orig; const b = $("#save"); if (b) b.disabled = !S.dirty; };
  function discPreview() {
    const el = $("#dprev"); if (!el) return;
    const base = num(S.F.base), cur = (S.products.find((x) => x.id === S.editId) || {}).currency || "";
    if (base == null) { el.textContent = "Avval narxni kiriting"; return; }
    el.innerHTML = S.F.pct > 0 ? `Xaridor ko'radi: <b>${esc(money(Math.round(base * (1 - S.F.pct / 100)), cur))}</b> <s style="opacity:.6">${esc(fmt(base))}</s> · -${S.F.pct}%` : `Chegirmasiz narx: <b>${esc(money(base, cur))}</b>`;
  }
  function drawStock() {
    const box = $("#stockbody"); if (!box) return;
    const F = S.F;
    $$("#stockseg button").forEach((b) => b.classList.toggle("on", b.dataset.v === F.mode));
    if (F.mode === "off") box.innerHTML = `<p class="muted small">Qoldiq hisoblanmaydi: mahsulot doim sotuvda. Razmer yoki son bo'yicha qoldiqni yoqsangiz, tugagan mahsulot avtomatik «Tugadi» bo'ladi.</p>`;
    else if (F.mode === "total") box.innerHTML = `<div class="sizerow"><span class="muted" style="flex:0 0 auto">Soni</span><div class="stepper"><button data-act="tdec" aria-label="-">${icon("minus", 20)}</button><input id="totin" inputmode="numeric" value="${F.total}" aria-label="Soni"><button data-act="tinc" aria-label="+">${icon("plus", 20)}</button></div></div>`;
    else box.innerHTML = `${F.sizes.map((r, i) => `<div class="sizerow"><input class="input sname" data-sz="${i}" value="${esc(r.s)}" placeholder="46" maxlength="12" aria-label="Razmer"><div class="stepper"><button data-act="sdec" data-i="${i}" aria-label="-">${icon("minus", 20)}</button><input data-sq="${i}" inputmode="numeric" value="${r.q}" aria-label="Soni"><button data-act="sinc" data-i="${i}" aria-label="+">${icon("plus", 20)}</button></div><button class="ib" data-act="srm" data-i="${i}" aria-label="O'chirish">${icon("trash", 20)}</button></div>`).join("")}
<button class="btn secondary sm" data-act="sadd">${icon("plus", 18)} Razmer qo'shish</button>
<div class="runs">${[["46-52", ["46", "48", "50", "52"]], ["S-XL", ["S", "M", "L", "XL"]], ["40-44", ["40", "41", "42", "43", "44"]]].map(([l, a]) => `<button class="chip" data-act="srun" data-v="${a.join(",")}">${l}</button>`).join("")}</div>`;
  }
  async function viewProduct(r) {
    if (!S.products.length) await loadProducts();
    const p = S.products.find((x) => x.id === r.id);
    if (!p) return { html: `${topbar("")}${empty("box", "Mahsulot topilmadi", "", `<a class="btn" href="#/products">Mahsulotlarga qaytish</a>`)}` };
    if (S.editId !== p.id) initForm(p);
    const F = S.F, cur = p.currency;
    return {
      cta: `<div class="in"><button class="btn block" id="save" data-act="save" ${S.dirty ? "" : "disabled"}>Saqlash</button></div>`,
      html: `${topbar("Tahrirlash", `<button class="ib" data-act="del" aria-label="O'chirish" style="color:var(--danger)">${icon("trash", 22)}</button>`, "#" + p.id)}
<div class="section"><div class="card photo-prev">${p.photo ? `<img src="${esc(thumb(p.photo, 240))}" alt="">` : ""}<div><b style="font-size:16px">${esc(p.translations.uz.title)}</b><div class="muted small" style="margin-top:4px">${p.photo ? "Rasmni almashtirish uchun mahsulotni botga qayta yuboring" : "Rasm yo'q"}</div></div></div>
<div class="card"><h2>${icon("edit", 18)} Asosiy</h2><div class="field"><label for="tu">Nomi</label><input class="input" id="tu" data-f="tu" maxlength="120" value="${esc(F.tu)}"></div>
<div class="field"><label for="du">Tavsif</label><textarea class="input" id="du" data-f="du" maxlength="600" rows="3">${esc(F.du)}</textarea></div>
<details class="more"><summary>${icon("globe", 18)} Ruscha va inglizcha tarjima</summary>
<div class="field" style="margin-top:10px"><label>Nomi (ruscha)</label><input class="input" data-f="tr" maxlength="120" value="${esc(F.tr)}"></div><div class="field"><label>Tavsif (ruscha)</label><textarea class="input" data-f="dr" maxlength="600" rows="2">${esc(F.dr)}</textarea></div>
<div class="field"><label>Nomi (inglizcha)</label><input class="input" data-f="te" maxlength="120" value="${esc(F.te)}"></div><div class="field"><label>Tavsif (inglizcha)</label><textarea class="input" data-f="de" maxlength="600" rows="2">${esc(F.de)}</textarea></div></details></div>
<div class="card"><h2>${icon("tag", 18)} Narx va chegirma</h2><div class="field"><label for="base">Narx</label><div class="input-wrap"><input class="input" id="base" data-f="base" inputmode="numeric" placeholder="0" value="${esc(F.base)}" style="padding-right:56px"><span class="suffix">${esc(cur)}</span></div></div>
<div class="field" style="margin-bottom:0"><label>Chegirma</label><div class="discrow">${[0, 5, 10, 15, 20, 30, 50].map((v) => `<button class="chip ${F.pct === v ? "on" : ""}" data-act="pct" data-v="${v}">${v ? "-" + v + "%" : "Yo'q"}</button>`).join("")}</div><div class="dprev" id="dprev"></div></div></div>
<div class="card"><h2>${icon("grid", 18)} Kategoriya</h2><div class="field" style="margin-bottom:10px"><input class="input" id="cat" data-f="category" maxlength="30" placeholder="Masalan: Kurtkalar" value="${esc(F.category)}"></div>
${S.categories.length ? `<div class="runs" style="margin-top:0">${S.categories.map((c) => `<button class="chip ${F.category === c ? "on" : ""}" data-act="setcat" data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}</div>
<div class="card"><h2>${icon("box", 18)} Qoldiq</h2><div class="seg" id="stockseg" style="margin-bottom:14px"><button data-act="mode" data-v="off">Kuzatilmaydi</button><button data-act="mode" data-v="total">Umumiy</button><button data-act="mode" data-v="sizes">Razmerlar</button></div><div id="stockbody"></div></div></div>
<div class="danger-zone"><button class="btn danger block" data-act="del">${icon("trash", 20)} Mahsulotni o'chirish</button></div>`,
      mount() { drawStock(); discPreview(); },
    };
  }
  async function saveProduct() {
    const F = S.F, o = JSON.parse(S.orig), p = S.products.find((x) => x.id === S.editId);
    if (!F.tu.trim()) { toast("Mahsulot nomini kiriting", "err"); return $("#tu").focus(); }
    const base = num(F.base);
    if (F.base !== "" && (base == null || base < 0)) return toast("Narx noto'g'ri", "err");
    if (F.pct > 0 && base == null) return toast("Chegirma uchun narxni kiriting", "err");
    let stock = null;
    if (F.mode === "total") stock = { _: Math.max(0, Math.floor(Number(F.total) || 0)) };
    else if (F.mode === "sizes") {
      stock = {};
      for (const r of F.sizes) { const k = r.s.trim(); if (!k) continue; if (k in stock) return toast(`Razmer takrorlandi: ${k}`, "err"); stock[k] = Math.max(0, Math.floor(Number(r.q) || 0)); }
      if (!Object.keys(stock).length) return toast("Kamida bitta razmer kiriting", "err");
    }
    const body = { category: F.category.trim(), translations: { uz: { title: F.tu, description: F.du }, ru: { title: F.tr, description: F.dr }, en: { title: F.te, description: F.de } }, stock };
    const baseChanged = F.base !== o.base, pctChanged = F.pct !== o.pct;
    if (baseChanged) body.price = base;
    if (pctChanged || (baseChanged && F.pct > 0)) body.discount = F.pct > 0 ? F.pct : null;
    const b = $("#save"); b.classList.add("loading");
    try { await api("/products/" + p.id, "POST", body); } catch (e) { b.classList.remove("loading"); return toast(e.code === "bad stock" ? "Qoldiq noto'g'ri" : "Saqlab bo'lmadi, qayta urinib ko'ring", "err"); }
    S.dirty = false; S.editId = null; toast("Saqlandi", "ok"); await loadProducts(); back();
  }

  // ------------------------------------------------------------------ orders
  async function viewOrders() {
    S.orders = (await api("/orders")).orders;
    const list = S.orders.filter((o) => o.status === S.of);
    return {
      html: `${topbar("Buyurtmalar", "", `${S.orders.length} ta`)}
<div class="toolbar"><div class="chips">${Object.entries(STATUS).map(([k, l]) => `<button class="chip ${S.of === k ? "on" : ""}" data-act="of" data-v="${k}">${l}<span class="n">${S.orders.filter((o) => o.status === k).length}</span></button>`).join("")}</div></div>
<div style="margin:4px 16px">${list.length ? list.map((o) => ocard(o, true)).join("") : empty("receipt", "Buyurtma yo'q", S.of === "new" ? "Yangi buyurtmalar shu yerda ko'rinadi" : "Bu holatda buyurtma yo'q")}</div>`,
    };
  }
  const stepIdx = { new: 0, confirmed: 1, shipped: 2 };
  async function viewOrder(r) {
    if (!S.orders.length || !S.orders.find((x) => x.id === r.id)) S.orders = (await api("/orders")).orders;
    const o = S.orders.find((x) => x.id === r.id);
    if (!o) return { html: `${topbar("")}${empty("receipt", "Buyurtma topilmadi", "", `<a class="btn" href="#/orders">Buyurtmalarga qaytish</a>`)}` };
    const idx = stepIdx[o.status] ?? 0, cancelled = o.status === "cancelled";
    const tel = o.phone.replace(/[^\d+]/g, "");
    const act = { new: [["cancelled", "Bekor qilish", "danger"], ["confirmed", "Tasdiqlash", ""]], confirmed: [["cancelled", "Bekor qilish", "danger"], ["shipped", "Yuborildi", ""]] }[o.status];
    return {
      cta: act ? `<div class="in">${act.map(([s, l, c]) => `<button class="btn ${c}" style="flex:1" data-act="ostatus" data-id="${o.id}" data-s="${s}">${l}</button>`).join("")}</div>` : "",
      html: `${topbar("Buyurtma #" + o.id, "", ago(o.created_at))}
<div class="section"><div class="card"><div class="oh" style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">${esc(STATUS[o.status])}</b><span class="badge ${STAT_CLS[o.status]}">#${o.id}</span></div>
${cancelled ? "" : `<div class="tl">${[0, 1, 2].map((k) => `${k ? `<div class="ln ${idx >= k ? "on" : ""}"></div>` : ""}<div class="d ${idx >= k ? "on" : ""}">${idx >= k ? icon("check", 11) : ""}</div>`).join("")}</div><div class="tll">${["Yangi", "Tasdiqlangan", "Yuborilgan"].map((l, i) => `<span class="${idx === i ? "on" : ""}">${l}</span>`).join("")}</div>`}</div>
<div class="card"><h2>${icon("user", 18)} Xaridor</h2><div class="kv"><span>Ism</span><b>${esc(o.name)}</b></div><div class="kv"><span>Telefon</span><b>${esc(o.phone)}</b></div>
${o.address ? `<div class="kv"><span>Manzil</span><b>${esc(o.address)}</b></div>` : ""}${o.note ? `<div class="kv"><span>Izoh</span><b>${esc(o.note)}</b></div>` : ""}
<div class="contactrow"><a class="btn secondary sm" href="tel:${esc(tel)}">${icon("phone", 18)} Qo'ng'iroq</a><button class="btn ghost sm" data-act="copy" data-v="${esc(o.phone)}">${icon("copy", 18)} Nusxalash</button></div></div>
<div class="card"><h2>${icon("bag", 18)} Mahsulotlar</h2>${o.items.map((i) => `<div class="oitem"><span>${esc(i.title)}${i.size ? ` <span class="badge gray">${esc(i.size)}</span>` : ""} <span class="muted">× ${i.qty}</span></span><b>${i.price != null ? esc(money(i.price * i.qty, i.currency)) : "—"}</b></div>`).join("")}
${o.discount ? `<div class="kv"><span>Chegirma</span><b style="color:var(--success)">${esc(o.discount)}</b></div>` : ""}${o.delivery ? `<div class="kv"><span>Yetkazib berish</span><b>${esc(o.delivery)}</b></div>` : ""}<div class="kv tot"><span>Jami</span><b>${esc(o.total)}</b></div></div></div>`,
    };
  }
  async function setStatus(id, status) {
    if (status === "cancelled" && !(await confirmDialog({ title: "Buyurtma bekor qilinsinmi?", text: "Qoldiq qaytariladi va xaridorga xabar yuboriladi.", ok: "Ha, bekor qilish", cancel: "Yo'q", danger: true }))) return;
    try {
      const r = await api(`/orders/${id}/status`, "POST", { status });
      const i = S.orders.findIndex((o) => o.id === id); if (i >= 0) S.orders[i] = r.order;
      haptic("ok"); toast(r.order.buyer_tg_id ? "Xaridorga xabar yuborildi" : "Holat yangilandi", "ok");
      const rt = route().name;
      if (rt === "order") render(true); else if (rt === "orders") render(true); else render(true);
    } catch { toast("Xatolik, qayta urinib ko'ring", "err"); }
  }

  // ------------------------------------------------------------------ settings
  const loadSettings = async () => { const d = await api("/settings"); S.settings = d; return d; };
  const settingsRow = (ic, t, s, href) => `<a class="row" href="${href}"><span class="ric">${icon(ic, 20)}</span><span class="rt"><b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ""}</span><span class="chev">${icon("chev", 18)}</span></a>`;
  async function viewSettings() {
    const { settings: s, promos } = await loadSettings();
    const activeP = promos.filter((p) => p.active).length;
    return {
      html: `${topbar("Sozlamalar")}
<div class="group-title">Do'kon</div><div class="list">${settingsRow("store", "Do'kon ma'lumotlari", s.name, "#/settings/shop")}${settingsRow("palette", "Ko'rinish", "Do'kon rangi", "#/settings/look")}${settingsRow("percent", "Promokodlar", activeP ? `${activeP} ta faol` : "Hali yo'q", "#/settings/promos")}</div>
<div class="group-title">Sotuv</div><div class="list">${settingsRow("truck", "Yetkazib berish", s.deliveryFee ? `${fmt(s.deliveryFee)}${s.freeFrom ? `, ${fmt(s.freeFrom)} dan bepul` : ""}` : "Sozlanmagan", "#/settings/delivery")}${settingsRow("card", "To'lov ma'lumoti", s.payment || "Kiritilmagan", "#/settings/payment")}</div>
<div class="group-title">Boshqa</div><div class="list">${settingsRow("sparkle", "Bot orqali imkoniyatlar", "Kanal, rassilka, menejerlar, banner", "#/settings/more")}</div>
<p class="faint small" style="text-align:center;margin:24px">Savia</p>`,
    };
  }
  const saveBar = (label = "Saqlash") => `<div class="in"><button class="btn block" id="save" data-act="savesettings" disabled>${label}</button></div>`;
  const fld = (id, label, val = "", extra = "", hint = "") => `<div class="field"><label for="${id}">${esc(label)}</label><input class="input" id="${id}" name="${id}" value="${esc(val)}" ${extra}>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}</div>`;
  const moneyFld = (id, label, val, hint) => `<div class="field"><label for="${id}">${esc(label)}</label><div class="input-wrap"><input class="input" id="${id}" name="${id}" inputmode="numeric" value="${val ? esc(val) : ""}" placeholder="0" style="padding-right:56px"><span class="suffix">so'm</span></div>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}</div>`;
  const dirtyWatch = (root) => root.addEventListener("input", () => { S.dirty = true; const b = $("#save"); if (b) b.disabled = false; });

  async function viewSetShop() {
    const { settings: s } = await loadSettings(); S.dirty = false;
    const ph = s.phones;
    return {
      cta: saveBar(),
      html: `${topbar("Do'kon ma'lumotlari")}<div class="section"><form class="card" id="sform" data-kind="shop" novalidate>
${fld("name", "Do'kon nomi", s.name, 'maxlength="60" required')}<div class="field"><label for="about">Qisqa tavsif</label><textarea class="input" id="about" name="about" maxlength="300" rows="3" placeholder="Masalan: Erkaklar kiyimi, Toshkent">${esc(s.about)}</textarea></div>
${fld("contact", "Aloqa", s.contact, 'placeholder="@username yoki +998..." maxlength="80"', "Xaridor «Sotuvchiga yozish» tugmasi orqali shu yerga o'tadi")}
${[0, 1, 2].map((i) => fld("phone" + i, i ? `Telefon ${i + 1} (ixtiyoriy)` : "Telefon", ph[i] || "", 'type="tel" inputmode="tel" maxlength="20" placeholder="+998 90 123 45 67"')).join("")}
${fld("address", "Manzil", s.address, 'maxlength="200" placeholder="Shahar, ko\'cha, mo\'ljal"')}</form></div>`,
      mount() { dirtyWatch($("#sform")); },
    };
  }
  async function viewSetDelivery() {
    const { settings: s } = await loadSettings(); S.dirty = false;
    return {
      cta: saveBar(),
      html: `${topbar("Yetkazib berish")}<div class="section"><form class="card" id="sform" data-kind="delivery" novalidate>
${moneyFld("deliveryFee", "Yetkazib berish narxi", s.deliveryFee, "0 yoki bo'sh = bepul yoki xaridor bilan kelishiladi")}${moneyFld("freeFrom", "Shu summadan boshlab bepul", s.freeFrom, "Masalan 500 000: xaridor savatda «bepul yetkazish uchun yana ... kerak» ni ko'radi. Bu ko'proq xarid qildiradi.")}
${moneyFld("minOrder", "Minimal buyurtma summasi", s.minOrder, "0 = cheklov yo'q")}</form></div>`,
      mount() { dirtyWatch($("#sform")); },
    };
  }
  async function viewSetPayment() {
    const { settings: s } = await loadSettings(); S.dirty = false;
    return {
      cta: saveBar(),
      html: `${topbar("To'lov ma'lumoti")}<div class="section"><form class="card" id="sform" data-kind="payment" novalidate><div class="field"><label for="payment">Xaridorga buyurtmadan keyin ko'rsatiladi</label><textarea class="input" id="payment" name="payment" rows="4" maxlength="200" placeholder="Karta: 8600 1234 5678 9012\nEgasi: Gulnora A.">${esc(s.payment)}</textarea></div>
<div class="runs" style="margin-top:0"><button type="button" class="chip" data-act="payfill" data-v="Karta: 8600 0000 0000 0000&#10;Egasi: Ism F.">Karta</button><button type="button" class="chip" data-act="payfill" data-v="Naqd pul, yetkazib berilganda">Naqd pul</button><button type="button" class="chip" data-act="payfill" data-v="Click / Payme: +998 90 000 00 00">Click / Payme</button></div>
<p class="hint" style="margin-top:12px">Hozircha onlayn to'lov yo'q: xaridor buyurtma beradi, siz bilan kelishadi va yuqoridagi ma'lumot bo'yicha to'laydi.</p></form></div>`,
      mount() { dirtyWatch($("#sform")); },
    };
  }
  const SWATCHES = ["", "#2563eb", "#4f46e5", "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#b45309", "#15803d", "#111827"];
  function drawLook() {
    const pv = $("#lookprev"); if (!pv) return;
    const hex = S.F.accent || "#0f766e";
    pv.setAttribute("style", accentVars(hex));
    $$("#sw .sw").forEach((b) => b.classList.toggle("on", b.dataset.v === S.F.accent));
  }
  async function viewSetLook() {
    const { settings: s } = await loadSettings(); S.dirty = false; S.editId = null; S.F = { accent: s.accent || "" };
    return {
      cta: saveBar(),
      html: `${topbar("Ko'rinish")}<div class="section"><div class="card"><h2>Do'kon rangi</h2><p class="muted small" style="margin-bottom:14px">Xaridorlar do'koningizni shu rangda ko'radi: tugmalar, belgilar va chiplar.</p>
<div class="swatches" id="sw">${SWATCHES.map((c) => `<button class="sw" data-act="swatch" data-v="${c}" style="background:${c || "#0f766e"}" aria-label="${c || "Standart"}">${icon("check", 18)}</button>`).join("")}</div>
<div class="preview" id="lookprev"><div class="ph"><div class="avatar">${esc(initial(s.name))}</div><b>${esc(s.name)}</b></div><div class="chips"><span class="chip on">Hammasi</span><span class="chip">Kurtkalar</span><span class="chip">Shimlar</span></div><button class="btn block">Savatga qo'shish</button></div></div></div>`,
      mount() { drawLook(); $$("#sw .sw").forEach((b) => { b.style.color = "#fff"; }); },
    };
  }
  const promoRows = (list) => (list.length ? list.map((p) => `<div class="prm"><div class="pc"><b>${esc(p.code)}</b><span>-${p.percent}% · ${p.uses} marta ishlatilgan${p.active ? "" : " · o'chiq"}</span></div>${p.active ? `<button class="btn ghost sm" data-act="promooff" data-v="${esc(p.code)}">O'chirish</button>` : `<span class="badge gray">O'chiq</span>`}</div>`).join("") : `<p class="muted" style="padding:8px 0">Promokod yo'q. Chegirma berib xaridorni qiziqtiring.</p>`);
  async function viewSetPromos() {
    const { promos } = await loadSettings(); S.promos = promos;
    return {
      html: `${topbar("Promokodlar", `<button class="ib" data-act="promoadd" aria-label="Qo'shish">${icon("plus", 24)}</button>`)}<div class="section"><div class="card" id="promolist">${promoRows(promos)}</div><button class="btn block" style="margin-top:12px" data-act="promoadd">${icon("plus", 20)} Yangi promokod</button></div>`,
    };
  }
  const MORE = [
    ["link", "Kanalni ulash", "/channel", "Botni kanalga administrator qiling va kanaldan bitta postni botga forward qiling. Keyin har yangi post avtomatik mahsulot bo'ladi, tagida «Buyurtma berish» tugmasi chiqadi."],
    ["megaphone", "Xaridorlarga rassilka", "/broadcast", "Yangi kolleksiya yoki aksiya haqida xabar yuboring. Ko'rib chiqib tasdiqlaysiz, keyin yuboriladi (kuniga 3 tagacha)."],
    ["users", "Menejer qo'shish", "/invite", "Bir martalik havola oling va menejerga yuboring. U ham buyurtmalarni qabul qila oladi va panelni ochadi."],
    ["image", "Banner qo'yish", "/banner", "Rasm yuboring va izohga /banner yozing. Banner do'konning tepasida chiqadi."],
  ];
  function viewSetMore() {
    return {
      html: `${topbar("Bot orqali imkoniyatlar")}<div class="section">${MORE.map(([ic, t, c, d]) => `<div class="card cmd"><span class="ric">${icon(ic, 22)}</span><div><b>${t}</b> <code>${c}</code><p>${d}</p></div></div>`).join("")}<button class="btn block" style="margin-top:12px" data-act="tobot">${icon("send", 20)} Botga o'tish</button></div>`,
    };
  }
  async function saveSettings() {
    const kind = (route().name || "").replace("set-", ""), form = $("#sform");
    let body = {};
    if (kind === "look") body = { accent: S.F.accent };
    else {
      const v = (n) => form.elements[n].value;
      if (kind === "shop") {
        if (!v("name").trim()) { toast("Do'kon nomini kiriting", "err"); return form.elements.name.focus(); }
        body = { name: v("name"), about: v("about"), contact: v("contact"), address: v("address"), phones: [0, 1, 2].map((i) => v("phone" + i).trim()).filter(Boolean) };
      } else if (kind === "delivery") body = { deliveryFee: num(v("deliveryFee")) || 0, freeFrom: num(v("freeFrom")) || 0, minOrder: num(v("minOrder")) || 0 };
      else if (kind === "payment") body = { payment: v("payment") };
    }
    const b = $("#save"); b.classList.add("loading");
    try { await api("/settings", "POST", body); } catch { b.classList.remove("loading"); return toast("Saqlab bo'lmadi, qayta urinib ko'ring", "err"); }
    S.dirty = false; toast("Saqlandi", "ok"); back();
  }
  function promoSheet() {
    sheet({ title: "Yangi promokod", html: `<form id="pform"><div class="field"><label for="pcode">Kod</label><input class="input" id="pcode" maxlength="20" placeholder="YOZ10" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase"><div class="hint">2–20 ta harf yoki raqam</div></div>
<div class="field"><label>Chegirma</label><div class="discrow" id="ppct">${[5, 10, 15, 20, 30].map((v) => `<button type="button" class="chip ${v === 10 ? "on" : ""}" data-pp="${v}">-${v}%</button>`).join("")}</div></div><button class="btn block" id="psave">Saqlash</button></form>`,
      onMount(el) {},
    });
    let pp = 10;
    $$("#ppct .chip").forEach((c) => (c.onclick = () => { pp = Number(c.dataset.pp); $$("#ppct .chip").forEach((x) => x.classList.toggle("on", x === c)); }));
    $("#pform").onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api("/promos", "POST", { code: $("#pcode").value, percent: pp }); S.promos = r.promos; closeLayer(); toast("Promokod saqlandi", "ok"); if (route().name === "set-promos") $("#promolist").innerHTML = promoRows(r.promos); }
      catch { toast("Kod 2–20 ta harf/raqam bo'lishi kerak", "err"); }
    };
  }

  // ------------------------------------------------------------------ render
  const views = { home: viewHome, products: viewProducts, product: viewProduct, orders: viewOrders, order: viewOrder, settings: viewSettings, "set-shop": viewSetShop, "set-delivery": viewSetDelivery, "set-payment": viewSetPayment, "set-look": viewSetLook, "set-promos": viewSetPromos, "set-more": viewSetMore };
  function renderTabs(hide, active) {
    const tab = (href, key, ic, l, badge) => `<a href="${href}" data-tab class="${active === key ? "on" : ""}">${icon(ic, 24)}<span>${l}</span>${badge ? `<i class="dot">${badge}</i>` : ""}</a>`;
    const nn = S.ov ? S.ov.stats.ordersNew : 0;
    tabs.innerHTML = `<div class="in">${tab("#/", "home", "home", "Bosh")}${tab("#/products", "products", "grid", "Mahsulot")}${tab("#/orders", "orders", "receipt", "Buyurtma", S.orders.filter((o) => o.status === "new").length || (nn || ""))}${tab("#/settings", "settings", "settings", "Sozlama")}</div>`;
    tabs.hidden = !!hide;
  }
  function errorView(e) {
    if (e && e.message === "auth") return empty("alert", "Ruxsat yo'q", "Bu panel faqat do'kon egasi va menejerlari uchun. Botda /start yuboring.");
    return `${topbar("")}${empty("alert", "Xatolik", "Internetni tekshirib, qayta urinib ko'ring.", `<button class="btn" data-act="reload">Qayta yuklash</button>`)}`;
  }
  async function render(keep) {
    const r = route(), my = ++S.rt;
    if (!keep) $("#toast").classList.remove("show");
    if (!tg || !tg.initData) { app.innerHTML = empty("send", "Telegram ichida oching", "Bu panel Telegram ichida ishlaydi. Botda /panel yuboring."); cta.hidden = true; tabs.hidden = true; return; }
    if (!keep) { app.innerHTML = `<div class="page"><header class="topbar"><div class="sk" style="width:44px;height:44px;border-radius:50%"></div><div class="sk" style="flex:1;height:22px"></div></header><div class="section"><div class="sk" style="height:120px"></div><div class="sk" style="height:200px;margin-top:12px"></div></div></div>`; cta.hidden = true; }
    let v;
    try { v = await (views[r.name] || viewHome)(r); } catch (e) { if (my !== S.rt) return; app.innerHTML = `<div class="page">${errorView(e)}</div>`; return; }
    if (my !== S.rt) return;
    app.innerHTML = `<div class="page${keep ? " still" : ""}">${v.html}</div>`;
    cta.hidden = !v.cta; cta.innerHTML = v.cta || "";
    document.body.classList.toggle("has-cta", !!v.cta); app.classList.toggle("has-cta", !!v.cta);
    renderTabs(!!v.cta, tabOf(r.name));
    if (v.mount) v.mount();
    if (!keep) window.scrollTo(0, 0);
    document.title = "Savia Panel";
    if (tg) { r.name === "home" ? tg.BackButton.hide() : tg.BackButton.show(); }
  }

  // ------------------------------------------------------------------ events
  document.addEventListener("click", async (e) => {
    const tab = e.target.closest("a[data-tab]");
    if (tab) {
      e.preventDefault(); if (!(await leaveOk())) return;
      const h = tab.getAttribute("href"); stack.length = 0; stack.push("#/"); if (h !== "#/") stack.push(h);
      if (curHash() === h) render(); else location.replace(h); return;
    }
    const link = e.target.closest("a[href^='#/']");
    if (link && !e.target.closest("[data-act]")) { if (S.dirty) { e.preventDefault(); if (await leaveOk()) location.hash = link.getAttribute("href"); } return; }
    const el = e.target.closest("[data-act]"); if (!el) return;
    const a = el.dataset.act, v = el.dataset.v, F = S.F;
    if (a === "back") { if (await leaveOk()) back(); return; }
    if (a === "reload") return render();
    if (a === "addinfo") return addInfo();
    if (a === "tobot") return toBot();
    if (a === "copylink") return copy(S.ov.url, "Do'kon linki nusxalandi");
    if (a === "openshop") return openLink(S.ov.url);
    if (a === "copy") return copy(v, "Nusxalandi");
    if (a === "pf") { S.pf = v; return drawProducts(); }
    if (a === "of") { S.of = v; return render(true); }
    if (a === "ostatus") { e.preventDefault(); e.stopPropagation(); return setStatus(Number(el.dataset.id), el.dataset.s); }
    if (a === "pct") { F.pct = Number(v); $$("[data-act=pct]").forEach((c) => c.classList.toggle("on", Number(c.dataset.v) === F.pct)); discPreview(); return markDirty(); }
    if (a === "setcat") { F.category = v; $("#cat").value = v; $$("[data-act=setcat]").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); return markDirty(); }
    if (a === "mode") { F.mode = v; drawStock(); return markDirty(); }
    if (a === "tinc" || a === "tdec") { F.total = Math.max(0, (Number(F.total) || 0) + (a === "tinc" ? 1 : -1)); $("#totin").value = F.total; haptic("light"); return markDirty(); }
    if (a === "sinc" || a === "sdec") { const r = F.sizes[Number(el.dataset.i)]; r.q = Math.max(0, (Number(r.q) || 0) + (a === "sinc" ? 1 : -1)); $(`[data-sq="${el.dataset.i}"]`).value = r.q; haptic("light"); return markDirty(); }
    if (a === "srm") { F.sizes.splice(Number(el.dataset.i), 1); drawStock(); return markDirty(); }
    if (a === "sadd") { F.sizes.push({ s: "", q: 0 }); drawStock(); const rows = $$(".sname"); rows[rows.length - 1].focus(); return markDirty(); }
    if (a === "srun") { for (const s of v.split(",")) if (!F.sizes.some((r) => r.s === s)) F.sizes.push({ s, q: 0 }); drawStock(); return markDirty(); }
    if (a === "save") return saveProduct();
    if (a === "del") {
      if (!(await confirmDialog({ title: "Mahsulot o'chirilsinmi?", text: "Bu amalni qaytarib bo'lmaydi.", ok: "O'chirish", cancel: "Bekor qilish", danger: true }))) return;
      try { await api("/products/" + S.editId, "DELETE"); } catch { return toast("O'chirib bo'lmadi", "err"); }
      S.dirty = false; S.editId = null; toast("O'chirildi", "ok"); await loadProducts(); return back();
    }
    if (a === "savesettings") return saveSettings();
    if (a === "swatch") { S.F.accent = v; drawLook(); S.dirty = true; $("#save").disabled = false; return haptic("light"); }
    if (a === "payfill") { const t = $("#payment"); t.value = (t.value ? t.value + "\n" : "") + v.replace(/&#10;/g, "\n"); S.dirty = true; $("#save").disabled = false; return t.focus(); }
    if (a === "promoadd") return promoSheet();
    if (a === "promooff") { try { const r = await api(`/promos/${encodeURIComponent(v)}/off`, "POST", {}); S.promos = r.promos; $("#promolist").innerHTML = promoRows(r.promos); toast("Promokod o'chirildi", "ok"); } catch { toast("Xatolik", "err"); } return; }
  });
  document.addEventListener("input", (e) => {
    const t = e.target, F = S.F;
    if (t.dataset && t.dataset.f && F) { F[t.dataset.f] = t.value; if (t.dataset.f === "base") discPreview(); if (t.dataset.f === "category") $$("[data-act=setcat]").forEach((c) => c.classList.toggle("on", c.dataset.v === t.value)); markDirty(); }
    else if (t.dataset && t.dataset.sz != null && F) { F.sizes[Number(t.dataset.sz)].s = t.value; markDirty(); }
    else if (t.dataset && t.dataset.sq != null && F) { F.sizes[Number(t.dataset.sq)].q = t.value.replace(/\D/g, ""); markDirty(); }
    else if (t.id === "totin" && F) { F.total = t.value.replace(/\D/g, ""); markDirty(); }
    else if (t.id === "pq") { S.q = t.value; drawProducts(); }
  });
  if (tg) tg.BackButton.onClick(async () => { if (await leaveOk()) back(); });
  render();
})();
