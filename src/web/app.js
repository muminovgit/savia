(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    document.documentElement.dataset.theme = tg.colorScheme === "dark" ? "dark" : "light";
  }
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n);

  const T = {
    uz: { all: "Hammasi", sale: "Chegirma", search: "Qidirish: nomi, kod, razmer", catalog: "Katalog", favs: "Sevimlilar", cart: "Savat", shop: "Do'kon", sold: "Tugadi",
      add: "Savatga qo'shish", added: "Savatga qo'shildi", pick: "Razmerni tanlang", ask: "Sotuvchi yordamchisiga savol bering", hint: "Masalan: razmeri bormi?", send: "Yuborish",
      empty: "Hozircha mahsulot yo'q", cartEmpty: "Savat bo'sh", favEmpty: "Sevimlilar bo'sh", total: "Jami", sub: "Mahsulotlar", disc: "Chegirma", deliv: "Yetkazib berish", free: "Bepul",
      promo: "Promokod", apply: "Qo'llash", promoBad: "Promokod topilmadi", promoOk: "Promokod qo'llandi", name: "Ismingiz", phone: "Telefon raqamingiz", addr: "Yetkazish manzili", note: "Izoh (ixtiyoriy)",
      order: "Buyurtma berish", sending: "Yuborilmoqda...", min: "Minimal buyurtma", placed: "Buyurtma qabul qilindi", thanks: "Sotuvchi tez orada siz bilan bog'lanadi.", pay: "To'lov ma'lumoti",
      back: "Katalogga qaytish", oos: "Yetarli emas", err: "Xatolik, qayta urinib ko'ring", left: "Qoldi", contact: "Sotuvchiga yozish", phones: "Telefonlar", address: "Manzil", delivery: "Yetkazib berish",
      freeFrom: "dan bepul", orderNo: "Buyurtma raqami", agree: "Narxi kelishiladi", noinfo: "Ma'lumot kiritilmagan", thinking: "..." },
    ru: { all: "Все", sale: "Скидки", search: "Поиск: название, код, размер", catalog: "Каталог", favs: "Избранное", cart: "Корзина", shop: "Магазин", sold: "Нет в наличии",
      add: "В корзину", added: "Добавлено в корзину", pick: "Выберите размер", ask: "Задайте вопрос помощнику продавца", hint: "Например: есть ли размер?", send: "Отправить",
      empty: "Товаров пока нет", cartEmpty: "Корзина пуста", favEmpty: "Избранное пусто", total: "Итого", sub: "Товары", disc: "Скидка", deliv: "Доставка", free: "Бесплатно",
      promo: "Промокод", apply: "Применить", promoBad: "Промокод не найден", promoOk: "Промокод применён", name: "Ваше имя", phone: "Ваш телефон", addr: "Адрес доставки", note: "Комментарий (необязательно)",
      order: "Оформить заказ", sending: "Отправка...", min: "Минимальный заказ", placed: "Заказ принят", thanks: "Продавец скоро свяжется с вами.", pay: "Данные для оплаты",
      back: "Вернуться в каталог", oos: "Недостаточно", err: "Ошибка, попробуйте снова", left: "Осталось", contact: "Написать продавцу", phones: "Телефоны", address: "Адрес", delivery: "Доставка",
      freeFrom: "бесплатно от", orderNo: "Номер заказа", agree: "Цена договорная", noinfo: "Информация не указана", thinking: "..." },
    en: { all: "All", sale: "Sale", search: "Search: name, code, size", catalog: "Catalog", favs: "Favorites", cart: "Cart", shop: "Shop", sold: "Sold out",
      add: "Add to cart", added: "Added to cart", pick: "Pick a size", ask: "Ask the seller's assistant", hint: "e.g. is size M available?", send: "Send",
      empty: "No products yet", cartEmpty: "Your cart is empty", favEmpty: "No favorites yet", total: "Total", sub: "Items", disc: "Discount", deliv: "Delivery", free: "Free",
      promo: "Promo code", apply: "Apply", promoBad: "Promo code not found", promoOk: "Promo code applied", name: "Your name", phone: "Your phone", addr: "Delivery address", note: "Note (optional)",
      order: "Place order", sending: "Sending...", min: "Minimum order", placed: "Order received", thanks: "The seller will contact you soon.", pay: "Payment details",
      back: "Back to catalog", oos: "Not enough stock", err: "Something went wrong, try again", left: "Left", contact: "Message the seller", phones: "Phones", address: "Address", delivery: "Delivery",
      freeFrom: "free from", orderNo: "Order number", agree: "Price on request", noinfo: "No information", thinking: "..." },
  };

  const startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
  const slug = document.body.dataset.slug || new URLSearchParams(location.search).get("slug") || startParam.split("__")[0];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const userLang = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || "uz";
  const S = {
    data: null,
    lang: store.get("lang", ["uz", "ru", "en"].includes(userLang.slice(0, 2)) ? userLang.slice(0, 2) : "uz"),
    cart: store.get("c:" + slug, []),
    favs: store.get("f:" + slug, []),
    cat: "", q: "", size: "", promo: "", quote: null, done: null,
  };
  const t = (k) => T[S.lang][k] || k;
  const saveCart = () => { store.set("c:" + slug, S.cart); drawTabs(); };
  const saveFavs = () => store.set("f:" + slug, S.favs);
  const find = (id) => S.data.products.find((p) => p.id === id);
  const title = (p) => p.translations[S.lang].title;
  const price = (p) => (p.price == null ? t("agree") : fmt(p.price) + " " + p.currency);
  const priceHtml = (p) => esc(price(p)) + (p.oldPrice ? "<s>" + esc(fmt(p.oldPrice)) + "</s>" : "");
  const pct = (p) => (p.oldPrice && p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
  const cartCount = () => S.cart.reduce((n, i) => n + i.qty, 0);
  const toast = (m) => { const el = $("#toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1800); };
  const api = async (url, body, headers) => {
    const r = await fetch(url, { method: body ? "POST" : "GET", headers: Object.assign({ "content-type": "application/json" }, headers || {}), body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, j: j || {} };
  };

  const ICON = {
    grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9-9.2C1.6 7.3 3.7 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.3 0 5.4 3.3 4 6.8C19 15.6 12 20 12 20z"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"/></svg>',
  };

  const route = () => {
    const h = location.hash.replace(/^#/, "") || "/";
    const m = /^\/p\/(\d+)/.exec(h);
    return m ? { name: "p", id: Number(m[1]) } : { name: h.slice(1) || "home" };
  };

  function drawTabs() {
    const r = route().name;
    const tab = (href, key, icon, label, badge) =>
      `<a href="${href}" class="${r === key ? "on" : ""}">${icon}${badge ? `<span class="dot">${badge}</span>` : ""}<span>${esc(label)}</span></a>`;
    $("#tabs").innerHTML =
      tab("#/", "home", ICON.grid, t("catalog")) + tab("#/fav", "fav", ICON.heart, t("favs"), S.favs.length || "") +
      tab("#/cart", "cart", ICON.cart, t("cart"), cartCount() || "") + tab("#/info", "info", ICON.shop, t("shop"));
    document.body.classList.toggle("pp", r === "p");
  }

  const langs = () => `<div class="langs">${["uz", "ru", "en"].map((l) => `<button data-lang="${l}" class="${S.lang === l ? "on" : ""}">${l.toUpperCase()}</button>`).join("")}</div>`;
  const header = () => `<div class="top"><div class="name">${esc(S.data.shop.name)}</div>${langs()}</div>`;

  const card = (p) => {
    const d = pct(p);
    const img = p.photos[0] ? `<img loading="lazy" src="${esc(p.photos[0])}" alt="">` : "";
    return `<a class="card" href="#/p/${p.id}"><div class="ph">${img}<button class="fav ${S.favs.includes(p.id) ? "on" : ""}" data-fav="${p.id}">♥</button>${d ? `<span class="badge">-${d}%</span>` : ""}${p.soldOut ? `<div class="soldtag">${esc(t("sold"))}</div>` : ""}</div><div class="cb"><div class="ct">${esc(title(p))}</div><div class="cp">${priceHtml(p)}</div></div></a>`;
  };
  const hay = (p) => [p.translations.uz.title, p.translations.ru.title, p.translations.en.title, p.category, ...Object.values(p.attributes)].join(" ").toLowerCase();

  function gridItems() {
    let items = S.data.products;
    if (S.cat === "__sale") items = items.filter((p) => p.oldPrice);
    else if (S.cat) items = items.filter((p) => p.category === S.cat);
    const q = S.q.trim().toLowerCase();
    if (q) items = items.filter((p) => hay(p).includes(q));
    return items;
  }
  function drawGrid() {
    const items = gridItems();
    $("#grid").innerHTML = items.length ? items.map(card).join("") : `<div class="empty" style="grid-column:1/-1">${esc(t("empty"))}</div>`;
  }

  function home() {
    const d = S.data;
    const hasSale = d.products.some((p) => p.oldPrice);
    const chips = [["", t("all")]].concat(hasSale ? [["__sale", t("sale")]] : [], d.categories.map((c) => [c, c]));
    return `${header()}${d.shop.about ? `<div class="about">${esc(d.shop.about)}</div>` : ""}
<input class="search" id="q" placeholder="${esc(t("search"))}" value="${esc(S.q)}">
${d.shop.banners.length ? `<div class="banners">${d.shop.banners.map((b) => `<img src="${esc(b)}" alt="">`).join("")}</div>` : ""}
${chips.length > 1 ? `<div class="chips">${chips.map(([v, l]) => `<button class="chip ${S.cat === v ? "on" : ""}" data-cat="${esc(v)}">${esc(l)}</button>`).join("")}</div>` : ""}
<div class="grid" id="grid"></div>`;
  }

  function productPage(id) {
    const p = find(id);
    if (!p) return `${header()}<div class="empty">404</div>`;
    const tr = p.translations[S.lang];
    const attrs = Object.entries(p.attributes).map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`).join("");
    const d = pct(p);
    return `<div class="gal">${p.photos.map((f) => `<img src="${esc(f)}" alt="">`).join("")}</div>
<div class="pbody"><h1>${esc(tr.title)}</h1>
<div class="price-l">${priceHtml(p)} ${d ? `<span class="badge" style="position:static;margin-left:8px">-${d}%</span>` : ""}</div>
${p.totalLeft ? `<div class="low">${esc(t("left"))}: ${p.totalLeft}</div>` : ""}
<div class="attrs">${attrs}</div>
${p.sizes.length ? `<div class="sizes">${p.sizes.map((s) => `<button class="sz ${S.size === s.s ? "on" : ""}" data-size="${esc(s.s)}" ${s.ok ? "" : "disabled"}>${esc(s.s)}${s.left ? `<small>${esc(t("left"))} ${s.left}</small>` : ""}</button>`).join("")}</div>` : ""}
<p class="desc">${esc(tr.description)}</p></div>
<div class="box"><h3>${esc(t("ask"))}</h3><div class="chat" id="chat"></div>
<form class="row" id="chatf"><input id="cq" maxlength="300" placeholder="${esc(t("hint"))}" required><button class="btn">${esc(t("send"))}</button></form></div>
<div class="bar"><div class="grow"><div class="cp" style="font-size:17px">${priceHtml(p)}</div></div>
<button class="btn" id="add" ${p.soldOut ? "disabled" : ""}>${esc(p.soldOut ? t("sold") : t("add"))}</button></div>`;
  }

  function favPage() {
    const items = S.data.products.filter((p) => S.favs.includes(p.id));
    return `${header()}<div class="grid" style="padding-top:8px">${items.length ? items.map(card).join("") : `<div class="empty" style="grid-column:1/-1">${esc(t("favEmpty"))}</div>`}</div>`;
  }

  function infoPage() {
    const s = S.data.shop;
    const bits = [];
    if (s.about) bits.push(`<p>${esc(s.about)}</p>`);
    if (s.phones.length) bits.push(`<p><b>${esc(t("phones"))}</b><br>${s.phones.map((p) => `<a href="tel:${esc(p.replace(/[^\d+]/g, ""))}">${esc(p)}</a>`).join("<br>")}</p>`);
    if (s.address) bits.push(`<p><b>${esc(t("address"))}</b><br>${esc(s.address)}</p>`);
    const del = [];
    if (s.deliveryFee) del.push(fmt(s.deliveryFee) + (s.freeFrom ? ` (${fmt(s.freeFrom)} ${t("freeFrom")})` : ""));
    if (s.minOrder) del.push(`${t("min")}: ${fmt(s.minOrder)}`);
    if (del.length) bits.push(`<p><b>${esc(t("delivery"))}</b><br>${esc(del.join(" · "))}</p>`);
    const c = s.contact.trim();
    const href = /^@\w+$/.test(c) ? `https://t.me/${c.slice(1)}` : /^\+?[\d\s()-]{7,}$/.test(c) ? `tel:${c.replace(/[^\d+]/g, "")}` : "";
    if (href) bits.push(`<p><a class="btn" style="display:inline-block" href="${esc(href)}">${esc(t("contact"))}</a></p>`);
    return `${header()}<div class="box info"><h3>${esc(s.name)}</h3>${bits.join("") || `<p class="empty">${esc(t("noinfo"))}</p>`}</div>`;
  }

  function cartPage() {
    if (S.done) {
      const d = S.done;
      return `<div class="done"><div class="tick">✓</div><h2>${esc(t("placed"))}</h2><p>${esc(t("orderNo"))}: <b>#${d.id}</b> · ${esc(d.total)}</p><p>${esc(t("thanks"))}</p>${d.payment ? `<div class="box"><b>${esc(t("pay"))}</b><p>${esc(d.payment)}</p></div>` : ""}<a class="btn" href="#/" style="display:inline-block">${esc(t("back"))}</a></div>`;
    }
    if (!S.cart.length) return `${header()}<div class="empty">${esc(t("cartEmpty"))}</div>`;
    const u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
    const rows = S.cart.map((i, idx) => {
      const p = find(i.id);
      if (!p) return "";
      return `<div class="item"><img src="${esc(p.photos[0] || "")}" alt=""><div class="t"><div>${esc(title(p))}${i.size ? ` (${esc(i.size)})` : ""}</div><div class="cp">${esc(price(p))}</div></div>
<div class="qty"><button data-qty="${idx}" data-d="-1">−</button><span>${i.qty}</span><button data-qty="${idx}" data-d="1">+</button></div></div>`;
    }).join("");
    return `${header()}<div class="box">${rows}</div>
<div class="box"><div class="row"><input id="promo" placeholder="${esc(t("promo"))}" value="${esc(S.promo)}"><button class="btn ghost" id="applyp">${esc(t("apply"))}</button></div><div id="pmsg"></div></div>
<div class="box sum" id="sum"></div>
<form class="box form" id="of"><input id="n" placeholder="${esc(t("name"))}" maxlength="80" value="${esc([u.first_name, u.last_name].filter(Boolean).join(" "))}" required>
<input id="p" type="tel" placeholder="${esc(t("phone"))}" maxlength="30" required><input id="a" placeholder="${esc(t("addr"))}" maxlength="200">
<textarea id="o" rows="2" maxlength="300" placeholder="${esc(t("note"))}"></textarea><button class="btn full" id="go">${esc(t("order"))}</button></form>`;
  }

  async function refreshQuote() {
    if (!$("#sum")) return;
    const r = await api("/api/quote", { slug, items: S.cart.map((i) => ({ id: i.id, qty: i.qty, size: i.size || "" })), promo: S.promo });
    if (!r.ok || !$("#sum")) return;
    const q = (S.quote = r.j);
    let html;
    if (q.currency) {
      const c = q.currency;
      html = `<div><span>${esc(t("sub"))}</span><span>${esc(fmt(q.subtotal))} ${esc(c)}</span></div>` +
        (q.discount ? `<div class="ok"><span>${esc(t("disc"))} (${q.promoPercent}%)</span><span>−${esc(fmt(q.discount))}</span></div>` : "") +
        (S.data.shop.deliveryFee ? `<div><span>${esc(t("deliv"))}</span><span>${q.delivery ? esc(fmt(q.delivery)) : esc(t("free"))}</span></div>` : "") +
        `<div class="tot"><span>${esc(t("total"))}</span><span>${esc(q.text)}</span></div>`;
      const short = q.minOrder > 0 && q.subtotal - q.discount < q.minOrder;
      if (short) html += `<div class="note">${esc(t("min"))}: ${esc(fmt(q.minOrder))} ${esc(c)}</div>`;
      $("#go").disabled = short;
    } else {
      html = `<div class="tot"><span>${esc(t("total"))}</span><span>${esc(q.text || t("agree"))}</span></div>`;
      $("#go").disabled = false;
    }
    $("#sum").innerHTML = html;
    if (S.promo) $("#pmsg").innerHTML = q.promoOk ? `<div class="ok" style="margin-top:6px">${esc(t("promoOk"))}</div>` : `<div class="note">${esc(t("promoBad"))}</div>`;
  }

  async function chat(form, p) {
    const input = $("#cq");
    const text = input.value.trim();
    if (!text) return;
    const log = $("#chat");
    const add = (c, m) => { const d = document.createElement("div"); d.className = "msg " + c; d.textContent = m; log.appendChild(d); return d; };
    add("u", text); input.value = "";
    const wait = add("a", t("thinking"));
    const r = await api("/api/chat", { productId: p.id, lang: S.lang, question: text });
    wait.textContent = r.j.answer || t("err");
  }

  async function submitOrder(e) {
    e.preventDefault();
    const b = $("#go");
    b.disabled = true; b.textContent = t("sending");
    const r = await api("/api/orders", {
      slug, items: S.cart.map((i) => ({ id: i.id, qty: i.qty, size: i.size || "" })), promo: S.promo,
      name: $("#n").value, phone: $("#p").value, address: $("#a").value, note: $("#o").value,
    }, { "x-tg-init": (tg && tg.initData) || "" });
    b.disabled = false; b.textContent = t("order");
    if (r.status === 409) return toast(`${t("oos")}: ${r.j.title}${r.j.size ? " (" + r.j.size + ")" : ""} — ${r.j.have}`);
    if (r.j.error === "bad_promo") return toast(t("promoBad"));
    if (!r.ok) return toast(t("err"));
    S.cart = []; S.promo = ""; saveCart();
    S.done = r.j;
    render();
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  }

  function render() {
    if (!S.data) return;
    const r = route();
    S.size = r.name === "p" && render.last !== "p" + r.id ? "" : S.size;
    render.last = r.name === "p" ? "p" + r.id : r.name;
    if (r.name !== "cart") S.done = null;
    const app = $("#app");
    app.innerHTML = r.name === "p" ? productPage(r.id) : r.name === "fav" ? favPage() : r.name === "cart" ? cartPage() : r.name === "info" ? infoPage() : home();
    document.documentElement.lang = S.lang;
    document.title = S.data.shop.name;
    if (r.name === "home") drawGrid();
    if (r.name === "cart") refreshQuote();
    drawTabs();
    if (tg) { r.name === "home" ? tg.BackButton.hide() : tg.BackButton.show(); }
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-fav],[data-lang],[data-cat],[data-size],[data-qty],#add,#applyp");
    if (!el) return;
    if (el.dataset.fav) {
      e.preventDefault(); e.stopPropagation();
      const id = Number(el.dataset.fav);
      S.favs = S.favs.includes(id) ? S.favs.filter((x) => x !== id) : S.favs.concat(id);
      saveFavs(); el.classList.toggle("on"); drawTabs();
      if (route().name === "fav") render();
    } else if (el.dataset.lang) {
      S.lang = el.dataset.lang; store.set("lang", S.lang); render();
    } else if (el.dataset.cat !== undefined) {
      S.cat = el.dataset.cat;
      document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.cat === S.cat));
      drawGrid();
    } else if (el.dataset.size) {
      S.size = el.dataset.size;
      document.querySelectorAll(".sz").forEach((c) => c.classList.toggle("on", c.dataset.size === S.size));
    } else if (el.dataset.qty !== undefined) {
      const i = S.cart[Number(el.dataset.qty)];
      i.qty += Number(el.dataset.d);
      if (i.qty < 1) S.cart.splice(Number(el.dataset.qty), 1);
      if (i && i.qty > 20) i.qty = 20;
      saveCart(); render();
    } else if (el.id === "add") {
      const p = find(route().id);
      if (p.sizes.length && !S.size) return toast(t("pick"));
      const line = S.cart.find((i) => i.id === p.id && (i.size || "") === S.size);
      if (line) line.qty = Math.min(20, line.qty + 1); else S.cart.push({ id: p.id, size: S.size, qty: 1 });
      saveCart(); toast(t("added"));
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    } else if (el.id === "applyp") {
      S.promo = $("#promo").value.trim(); refreshQuote();
    }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "q") { S.q = e.target.value; drawGrid(); } });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "chatf") { e.preventDefault(); chat(e.target, find(route().id)); }
    else if (e.target.id === "of") submitOrder(e);
  });
  window.addEventListener("hashchange", render);
  if (tg) tg.BackButton.onClick(() => (history.length > 1 ? history.back() : (location.hash = "#/")));

  (async () => {
    $("#app").innerHTML = '<div class="skeleton"></div>';
    if (!slug) { $("#app").innerHTML = '<div class="empty">Savia</div>'; return; }
    const r = await api("/api/shop/" + encodeURIComponent(slug));
    if (!r.ok) { $("#app").innerHTML = '<div class="empty">404</div>'; return; }
    S.data = r.j;
    S.cart = S.cart.filter((i) => find(i.id));
    const m = /__p(\d+)/.exec(startParam);
    if (m && !location.hash) location.hash = "#/p/" + m[1];
    render();
  })();
})();
