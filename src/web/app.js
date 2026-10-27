(() => {
  const { tg, $, $$, esc, fmt, icon, applyAccent, haptic, toast, sheet, closeLayer, confirmDialog, copy, initial, ago } = DS;

  // ------------------------------------------------------------------ texts
  const T = {
    uz: { catalog: "Katalog", favs: "Sevimlilar", cart: "Savat", shop: "Do'kon", back: "Orqaga", language: "Til", chooseLang: "Tilni tanlang", close: "Yopish",
      search: "Mahsulot qidirish", all: "Hammasi", sale: "Chegirma", sort: "Saralash", sortNew: "Yangilari", sortLow: "Avval arzon", sortHigh: "Avval qimmat", sortSale: "Chegirmali",
      count: "{n} ta mahsulot", nothing: "Hech narsa topilmadi", nothingSub: "Qidiruv yoki kategoriyani o'zgartirib ko'ring", reset: "Tozalash",
      noProducts: "Hozircha mahsulot yo'q", noProductsSub: "Do'kon tez orada to'ldiriladi", notFound: "Do'kon topilmadi", notFoundSub: "Havolani tekshirib, qayta urinib ko'ring",
      sold: "Tugadi", onlyLeft: "Oxirgi {n} ta", size: "Razmer", pickSize: "Razmerni tanlang", add: "Savatga qo'shish", goCart: "Savatga o'tish", added: "Savatga qo'shildi",
      askTitle: "Sotuvchiga savol", askSub: "AI yordamchi sotuvchi kiritgan ma'lumotdan javob beradi", hint: "Savolingizni yozing...", q1: "Razmeri bormi?", q2: "Yetkazib berish qancha?", q3: "Qanday materialdan?",
      similar: "O'xshash mahsulotlar", share: "Ulashish", linkCopied: "Havola nusxalandi", agree: "Narxi kelishiladi",
      cartEmptyT: "Savat bo'sh", cartEmptyS: "Yoqqan mahsulotni savatga qo'shing", toCatalog: "Katalogga o'tish", clear: "Tozalash", clearAsk: "Savat tozalansinmi?", clearOk: "Ha, tozalash",
      freeLeft: "Bepul yetkazish uchun yana {n} kerak", freeDone: "Yetkazib berish bepul 🎉", promoQ: "Promokodingiz bormi?", promo: "Promokod", apply: "Qo'llash", promoBad: "Bunday promokod yo'q", promoOk: "Promokod qo'llandi",
      sub: "Mahsulotlar", disc: "Chegirma", deliv: "Yetkazib berish", free: "Bepul", total: "Jami", minLeft: "Minimal buyurtma {n}. Yana {m} kerak.",
      yourData: "Ma'lumotlaringiz", delivSec: "Yetkazib berish", name: "Ismingiz", phone: "Telefon raqamingiz", addr: "Manzil", addrPh: "Shahar, ko'cha, uy", note: "Izoh (ixtiyoriy)",
      errName: "Ismingizni kiriting", errPhone: "Telefon raqamni to'g'ri kiriting", order: "Buyurtma berish", oos: "Afsuski, yetarli emas:", err: "Xatolik. Qayta urinib ko'ring",
      placed: "Buyurtma qabul qilindi!", orderNo: "Buyurtma raqami", next: "Keyingi qadamlar", st1: "Sotuvchi buyurtmangizni ko'rib chiqadi", st2: "Siz bilan bog'lanib, to'lov va yetkazishni kelishadi", st3: "Holat haqida Telegramda xabar olasiz",
      pay: "To'lov ma'lumoti", myOrders: "Buyurtmalarim", noOrders: "Buyurtmalar yo'q", noOrdersSub: "Birinchi buyurtmangiz shu yerda ko'rinadi", ordersTg: "Buyurtmalar tarixi Telegram ichida ko'rinadi",
      s_new: "Qabul qilindi", s_confirmed: "Tasdiqlandi", s_shipped: "Yuborildi", s_cancelled: "Bekor qilindi",
      contact: "Sotuvchiga yozish", phones: "Telefon", address: "Manzil", terms: "Yetkazib berish shartlari", feeFrom: "{a}, {b} dan bepul", minOrder: "Minimal buyurtma", copied: "Nusxalandi", copy: "Nusxalash" },
    ru: { catalog: "Каталог", favs: "Избранное", cart: "Корзина", shop: "Магазин", back: "Назад", language: "Язык", chooseLang: "Выберите язык", close: "Закрыть",
      search: "Поиск товаров", all: "Все", sale: "Скидки", sort: "Сортировка", sortNew: "Новые", sortLow: "Сначала дешёвые", sortHigh: "Сначала дорогие", sortSale: "Со скидкой",
      count: "Товаров: {n}", nothing: "Ничего не найдено", nothingSub: "Измените поиск или категорию", reset: "Сбросить",
      noProducts: "Товаров пока нет", noProductsSub: "Магазин скоро наполнится", notFound: "Магазин не найден", notFoundSub: "Проверьте ссылку и попробуйте снова",
      sold: "Нет в наличии", onlyLeft: "Осталось {n}", size: "Размер", pickSize: "Выберите размер", add: "В корзину", goCart: "Перейти в корзину", added: "Добавлено в корзину",
      askTitle: "Вопрос продавцу", askSub: "AI-помощник отвечает по данным продавца", hint: "Напишите вопрос...", q1: "Есть ли размер?", q2: "Сколько стоит доставка?", q3: "Из какого материала?",
      similar: "Похожие товары", share: "Поделиться", linkCopied: "Ссылка скопирована", agree: "Цена договорная",
      cartEmptyT: "Корзина пуста", cartEmptyS: "Добавьте понравившиеся товары", toCatalog: "В каталог", clear: "Очистить", clearAsk: "Очистить корзину?", clearOk: "Да, очистить",
      freeLeft: "До бесплатной доставки ещё {n}", freeDone: "Доставка бесплатна 🎉", promoQ: "Есть промокод?", promo: "Промокод", apply: "Применить", promoBad: "Такого промокода нет", promoOk: "Промокод применён",
      sub: "Товары", disc: "Скидка", deliv: "Доставка", free: "Бесплатно", total: "Итого", minLeft: "Минимальный заказ {n}. Не хватает {m}.",
      yourData: "Ваши данные", delivSec: "Доставка", name: "Ваше имя", phone: "Ваш телефон", addr: "Адрес", addrPh: "Город, улица, дом", note: "Комментарий (необязательно)",
      errName: "Введите имя", errPhone: "Введите корректный номер", order: "Оформить заказ", oos: "К сожалению, недостаточно:", err: "Ошибка. Попробуйте снова",
      placed: "Заказ принят!", orderNo: "Номер заказа", next: "Что дальше", st1: "Продавец проверит ваш заказ", st2: "Свяжется с вами для оплаты и доставки", st3: "Статус придёт вам в Telegram",
      pay: "Реквизиты для оплаты", myOrders: "Мои заказы", noOrders: "Заказов нет", noOrdersSub: "Ваш первый заказ появится здесь", ordersTg: "История заказов доступна внутри Telegram",
      s_new: "Принят", s_confirmed: "Подтверждён", s_shipped: "Отправлен", s_cancelled: "Отменён",
      contact: "Написать продавцу", phones: "Телефон", address: "Адрес", terms: "Условия доставки", feeFrom: "{a}, бесплатно от {b}", minOrder: "Минимальный заказ", copied: "Скопировано", copy: "Скопировать" },
    en: { catalog: "Catalog", favs: "Favorites", cart: "Cart", shop: "Shop", back: "Back", language: "Language", chooseLang: "Choose language", close: "Close",
      search: "Search products", all: "All", sale: "Sale", sort: "Sort", sortNew: "Newest", sortLow: "Price: low to high", sortHigh: "Price: high to low", sortSale: "On sale",
      count: "{n} items", nothing: "Nothing found", nothingSub: "Try changing your search or category", reset: "Clear",
      noProducts: "No products yet", noProductsSub: "The shop will be stocked soon", notFound: "Shop not found", notFoundSub: "Check the link and try again",
      sold: "Sold out", onlyLeft: "Only {n} left", size: "Size", pickSize: "Choose a size", add: "Add to cart", goCart: "Go to cart", added: "Added to cart",
      askTitle: "Ask the seller", askSub: "The AI assistant answers from the seller's data", hint: "Type your question...", q1: "Is my size available?", q2: "How much is delivery?", q3: "What is it made of?",
      similar: "You may also like", share: "Share", linkCopied: "Link copied", agree: "Price on request",
      cartEmptyT: "Your cart is empty", cartEmptyS: "Add something you like", toCatalog: "Browse catalog", clear: "Clear", clearAsk: "Clear the cart?", clearOk: "Yes, clear",
      freeLeft: "{n} more for free delivery", freeDone: "Free delivery unlocked 🎉", promoQ: "Have a promo code?", promo: "Promo code", apply: "Apply", promoBad: "Promo code not found", promoOk: "Promo code applied",
      sub: "Items", disc: "Discount", deliv: "Delivery", free: "Free", total: "Total", minLeft: "Minimum order {n}. {m} to go.",
      yourData: "Your details", delivSec: "Delivery", name: "Your name", phone: "Your phone", addr: "Address", addrPh: "City, street, building", note: "Note (optional)",
      errName: "Enter your name", errPhone: "Enter a valid phone number", order: "Place order", oos: "Not enough stock:", err: "Something went wrong. Try again",
      placed: "Order placed!", orderNo: "Order number", next: "What happens next", st1: "The seller reviews your order", st2: "They contact you to arrange payment and delivery", st3: "You get status updates in Telegram",
      pay: "Payment details", myOrders: "My orders", noOrders: "No orders yet", noOrdersSub: "Your first order will show up here", ordersTg: "Order history is available inside Telegram",
      s_new: "Received", s_confirmed: "Confirmed", s_shipped: "Shipped", s_cancelled: "Cancelled",
      contact: "Message the seller", phones: "Phone", address: "Address", terms: "Delivery terms", feeFrom: "{a}, free from {b}", minOrder: "Minimum order", copied: "Copied", copy: "Copy" },
  };

  // ------------------------------------------------------------------ state
  const startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
  const slug = document.body.dataset.slug || new URLSearchParams(location.search).get("slug") || startParam.split("__")[0];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const userLang = ((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || "uz").slice(0, 2);
  const S = {
    data: null, lang: store.get("lang", ["uz", "ru", "en"].includes(userLang) ? userLang : "uz"),
    cart: store.get("c:" + slug, []), favs: store.get("f:" + slug, []), me: store.get("u:" + slug, {}),
    cat: "", q: "", sort: "new", size: "", promo: "", quote: null, done: null, homeScroll: 0, prev: null, promoOpen: false,
  };
  const t = (k, v) => { let s = (T[S.lang] && T[S.lang][k]) || T.uz[k] || k; if (v) for (const a in v) s = s.replace("{" + a + "}", v[a]); return s; };
  const app = $("#app"), cta = $("#cta"), tabs = $("#tabs");
  const saveCart = () => store.set("c:" + slug, S.cart);
  const saveFavs = () => store.set("f:" + slug, S.favs);
  const find = (id) => S.data.products.find((p) => p.id === id);
  const title = (p) => p.translations[S.lang].title;
  const thumb = (u, w) => (u ? u.replace("/photos/", "/img/") + "?w=" + w : "");
  const money = (n, c) => fmt(n) + " " + c;
  const priceTxt = (p) => (p.price == null ? t("agree") : money(p.price, p.currency));
  const pct = (p) => (p.oldPrice && p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
  const cartCount = () => S.cart.reduce((n, i) => n + i.qty, 0);
  const lineKey = (i) => i.id + "|" + (i.size || "");
  const api = async (url, body, headers) => {
    try {
      const r = await fetch(url, { method: body ? "POST" : "GET", headers: Object.assign({ "content-type": "application/json" }, headers || {}), body: body ? JSON.stringify(body) : undefined });
      let j = {}; try { j = await r.json(); } catch {}
      return { ok: r.ok, status: r.status, j };
    } catch { return { ok: false, status: 0, j: {} }; }
  };
  const tgHeaders = () => ({ "x-tg-init": (tg && tg.initData) || "" });

  // ------------------------------------------------------------------ navigation (own stack so "back" always works)
  const stack = [];
  const curHash = () => location.hash || "#/";
  function route() {
    const h = curHash().replace(/^#/, "");
    const m = /^\/p\/(\d+)/.exec(h);
    if (m) return { name: "p", id: Number(m[1]) };
    const n = h.replace(/^\//, "");
    return { name: ["fav", "cart", "info", "orders", "done"].includes(n) ? n : "home" };
  }
  function back() {
    if (stack.length > 1) stack.pop();
    const h = stack[stack.length - 1] || "#/";
    if (!stack.length) stack.push("#/");
    if (curHash() === h) render(); else location.replace(h);
  }
  window.addEventListener("hashchange", () => {
    const h = curHash(), top = stack[stack.length - 1];
    if (h !== top) { if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop(); else stack.push(h); }
    render();
  });
  const first = curHash();
  stack.push("#/"); if (first !== "#/") stack.push(first);

  const topbar = (name, right = "") =>
    `<header class="topbar"><button class="ib" data-act="back" aria-label="${esc(t("back"))}">${icon("back", 26)}</button><h1>${name}</h1>${right}</header>`;
  const emptyState = (ic, ttl, sub, btn) =>
    `<div class="empty"><div class="art">${icon(ic, 44)}</div><h2>${esc(ttl)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}${btn || ""}</div>`;

  // ------------------------------------------------------------------ catalog
  const card = (p) => {
    const d = pct(p), low = p.totalLeft || (p.sizes.some((s) => s.left) ? Math.min(...p.sizes.filter((s) => s.left).map((s) => s.left)) : 0);
    return `<a class="pcard" href="#/p/${p.id}"><div class="pimg"><img loading="lazy" decoding="async" src="${esc(thumb(p.photos[0], 480))}" alt="${esc(title(p))}">
<button class="ib glass heart ${S.favs.includes(p.id) ? "on" : ""}" data-act="fav" data-id="${p.id}" aria-label="${esc(t("favs"))}">${icon("heart", 19)}</button>
<div class="pbadges">${d ? `<span class="badge sale">-${d}%</span>` : ""}</div>${p.soldOut ? `<div class="soldov"><span>${esc(t("sold"))}</span></div>` : ""}</div>
<div class="pinfo"><div class="pt">${esc(title(p))}</div><div class="pp"><b>${esc(priceTxt(p))}</b>${p.oldPrice ? `<s>${esc(fmt(p.oldPrice))}</s>` : ""}</div>${low && !p.soldOut ? `<div class="low">${esc(t("onlyLeft", { n: low }))}</div>` : ""}</div></a>`;
  };
  const hay = (p) => [p.translations.uz.title, p.translations.ru.title, p.translations.en.title, p.category, ...Object.values(p.attributes)].join(" ").toLowerCase();
  function visibleProducts() {
    let items = S.data.products.slice();
    if (S.cat === "__sale" || S.sort === "sale") items = items.filter((p) => p.oldPrice);
    if (S.cat && S.cat !== "__sale") items = items.filter((p) => p.category === S.cat);
    const q = S.q.trim().toLowerCase();
    if (q) items = items.filter((p) => hay(p).includes(q));
    const key = (p) => (p.price == null ? Infinity : p.price);
    if (S.sort === "low") items.sort((a, b) => key(a) - key(b));
    else if (S.sort === "high") items.sort((a, b) => (b.price == null ? -1 : b.price) - (a.price == null ? -1 : a.price));
    else if (S.sort === "sale") items.sort((a, b) => pct(b) - pct(a));
    else items.sort((a, b) => b.id - a.id);
    return items;
  }
  function drawGrid() {
    const g = $("#grid"); if (!g) return;
    const items = visibleProducts(), filtered = !!(S.cat || S.q.trim() || S.sort === "sale");
    $("#count").innerHTML = `<span>${esc(t("count", { n: items.length }))}</span>${filtered ? `<button class="tlink" data-act="reset">${esc(t("reset"))}</button>` : ""}`;
    if (items.length) { g.className = "pgrid"; g.innerHTML = items.map(card).join(""); return; }
    g.className = "";
    g.innerHTML = S.data.products.length
      ? emptyState("search", t("nothing"), t("nothingSub"), `<button class="btn secondary" data-act="reset">${esc(t("reset"))}</button>`)
      : emptyState("bag", t("noProducts"), t("noProductsSub"));
  }
  function viewHome() {
    const d = S.data, sh = d.shop;
    const chips = [["", t("all")]].concat(d.products.some((p) => p.oldPrice) ? [["__sale", t("sale")]] : [], d.categories.map((c) => [c, c]));
    return {
      html: `<header class="topbar home"><div class="avatar">${esc(initial(sh.name))}</div><div class="ttl"><b>${esc(sh.name)}</b>${sh.about ? `<small>${esc(sh.about)}</small>` : ""}</div>
<button class="ib" data-act="lang" aria-label="${esc(t("language"))}">${icon("globe")}</button></header>
${sh.banners.length ? `<div class="banners" id="ban">${sh.banners.map((b) => `<img src="${esc(thumb(b, 800))}" alt="" loading="lazy">`).join("")}</div>${sh.banners.length > 1 ? `<div class="bdots" id="bdots">${sh.banners.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}` : ""}
<div class="filters"><div class="searchbox">${icon("search", 20)}<input id="q" type="search" inputmode="search" enterkeyhint="search" placeholder="${esc(t("search"))}" value="${esc(S.q)}" aria-label="${esc(t("search"))}"><button class="ib" data-act="sort" aria-label="${esc(t("sort"))}">${icon("sort", 20)}</button></div>
${chips.length > 1 ? `<div class="chips" role="tablist">${chips.map(([v, l]) => `<button class="chip ${S.cat === v ? "on" : ""}" data-act="cat" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>` : ""}</div>
<div class="count" id="count"></div><div class="pgrid" id="grid"></div>`,
      mount() {
        drawGrid();
        const ban = $("#ban");
        if (ban) ban.addEventListener("scroll", () => { const i = Math.round(ban.scrollLeft / ban.clientWidth); $$("#bdots i").forEach((d, k) => d.classList.toggle("on", k === i)); }, { passive: true });
      },
    };
  }

  // ------------------------------------------------------------------ product
  const lineFor = (p) => S.cart.find((i) => i.id === p.id && (i.size || "") === S.size);
  function ctaProduct(p) {
    if (p.soldOut) return `<div class="in"><div class="price"><b>${esc(priceTxt(p))}</b></div><button class="btn" disabled>${esc(t("sold"))}</button></div>`;
    const line = lineFor(p);
    if (line) return `<div class="in"><div class="stepper"><button data-act="dec" aria-label="-">${icon("minus", 20)}</button><span>${line.qty}</span><button data-act="inc" aria-label="+">${icon("plus", 20)}</button></div><button class="btn" style="flex:1" data-act="go-cart">${icon("cart", 20)} ${esc(t("goCart"))}</button></div>`;
    const need = p.sizes.length && !S.size;
    return `<div class="in"><div class="price"><b>${esc(priceTxt(p))}</b>${p.oldPrice ? `<s>${esc(fmt(p.oldPrice))}</s>` : ""}</div><button class="btn" data-act="add">${esc(need ? t("pickSize") : t("add"))}</button></div>`;
  }
  function viewProduct(r) {
    const p = find(r.id);
    if (!p) return { html: `${topbar("")}${emptyState("box", "404", "", `<button class="btn" data-act="home">${esc(t("toCatalog"))}</button>`)}` };
    const tr = p.translations[S.lang], d = pct(p);
    const attrs = Object.entries(p.attributes).map(([k, v]) => `<span class="attr"><b>${esc(k)}</b>${esc(v)}</span>`).join("");
    const similar = S.data.products.filter((x) => x.id !== p.id && x.category && x.category === p.category).slice(0, 8);
    return {
      cta: ctaProduct(p),
      html: `<div class="floatbar"><button class="ib glass" data-act="back" aria-label="${esc(t("back"))}">${icon("back", 26)}</button>
<div class="grp"><button class="ib glass" data-act="share" aria-label="${esc(t("share"))}">${icon("share", 21)}</button><button class="ib glass heart ${S.favs.includes(p.id) ? "on" : ""}" data-act="fav" data-id="${p.id}" aria-label="${esc(t("favs"))}">${icon("heart", 21)}</button></div></div>
<div class="gwrap"><div class="gallery" id="gal">${(p.photos.length ? p.photos : [""]).map((u) => `<img src="${esc(thumb(u, 800))}" alt="${esc(tr.title)}" decoding="async">`).join("")}</div>
${p.photos.length > 1 ? `<div class="dots" id="dots">${p.photos.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}</div>
<div class="psheet">${p.category ? `<a class="crumb" href="#/" data-act="crumb" data-v="${esc(p.category)}">${esc(p.category)} ${icon("chev", 14)}</a>` : ""}
<h1>${esc(tr.title)}</h1>
<div class="pdp-price"><b>${esc(priceTxt(p))}</b>${p.oldPrice ? `<s>${esc(fmt(p.oldPrice))}</s><span class="badge sale">-${d}%</span>` : ""}${p.totalLeft ? `<span class="badge bad">${esc(t("onlyLeft", { n: p.totalLeft }))}</span>` : ""}</div>
${p.sizes.length ? `<div class="block" id="sizeblock"><div class="bh"><b>${esc(t("size"))}</b><span id="szsel">${esc(S.size)}</span></div><div class="sizes">${p.sizes.map((s) => `<button class="sz ${S.size === s.s ? "on" : ""}" data-act="size" data-v="${esc(s.s)}" ${s.ok ? "" : "disabled"}>${esc(s.s)}${s.left ? `<small>${esc(t("onlyLeft", { n: s.left }))}</small>` : ""}</button>`).join("")}</div></div>` : ""}
${attrs ? `<div class="block"><div class="attrs">${attrs}</div></div>` : ""}
${tr.description ? `<div class="block"><p class="desc">${esc(tr.description)}</p></div>` : ""}</div>
<div class="section" style="margin-top:20px"><div class="card"><h2>${icon("sparkle", 18)} ${esc(t("askTitle"))}</h2><p class="muted small">${esc(t("askSub"))}</p><div class="chat" id="chat"></div>
<div class="quick" id="quick">${["q1", "q2", "q3"].map((k) => `<button class="chip" data-act="ask" data-v="${esc(t(k))}">${esc(t(k))}</button>`).join("")}</div>
<form class="askrow" id="askf"><input class="input" id="askq" maxlength="300" placeholder="${esc(t("hint"))}" autocomplete="off" required><button class="btn" aria-label="${esc(t("askTitle"))}">${icon("send", 20)}</button></form></div></div>
${similar.length ? `<h2 style="margin:24px 20px 12px;font-size:18px;font-weight:800">${esc(t("similar"))}</h2><div class="hscroll mini">${similar.map(card).join("")}</div>` : ""}`,
      mount() {
        const gal = $("#gal");
        if (gal && $("#dots")) gal.addEventListener("scroll", () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); $$("#dots i").forEach((x, k) => x.classList.toggle("on", k === i)); }, { passive: true });
      },
    };
  }
  function refreshCta() { const r = route(); if (r.name !== "p") return; const p = find(r.id); cta.innerHTML = ctaProduct(p); }

  async function ask(text) {
    const log = $("#chat"); if (!log || !text.trim()) return;
    const add = (c, m) => { const d = document.createElement("div"); d.className = "msg " + c; d.textContent = m; log.appendChild(d); d.scrollIntoView({ block: "nearest", behavior: "smooth" }); return d; };
    add("u", text); const q = $("#quick"); if (q) q.remove();
    const wait = document.createElement("div"); wait.className = "msg a typing"; wait.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(wait);
    const r = await api("/api/chat", { productId: route().id, lang: S.lang, question: text });
    wait.remove(); add("a", r.j.answer || t("err"));
  }

  // ------------------------------------------------------------------ favorites
  function viewFav() {
    const items = S.data.products.filter((p) => S.favs.includes(p.id));
    return { html: `${topbar(esc(t("favs")))}${items.length ? `<div class="pgrid" style="padding-top:8px">${items.map(card).join("")}</div>` : emptyState("heart", t("favs"), t("cartEmptyS"), `<button class="btn" data-act="home">${esc(t("toCatalog"))}</button>`)}` };
  }

  // ------------------------------------------------------------------ cart
  const localSub = () => S.cart.reduce((n, i) => { const p = find(i.id); return n + (p && p.price != null ? p.price * i.qty : 0); }, 0);
  function viewCart() {
    if (!S.cart.length) return { html: `${topbar(esc(t("cart")))}${emptyState("cart", t("cartEmptyT"), t("cartEmptyS"), `<button class="btn" data-act="home">${esc(t("toCatalog"))}</button>`)}` };
    const sh = S.data.shop, u = S.me || {}, tu = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
    const rows = S.cart.map((i, idx) => {
      const p = find(i.id); if (!p) return "";
      return `<div class="citem"><a href="#/p/${p.id}"><img src="${esc(thumb(p.photos[0], 240))}" alt=""></a><div class="cm"><div class="ct">${esc(title(p))}</div>${i.size ? `<div class="cs">${esc(t("size"))}: ${esc(i.size)}</div>` : ""}
<div class="cb"><div class="cp">${esc(priceTxt(p))}</div><div class="stepper"><button data-act="cdec" data-k="${idx}" aria-label="-">${icon(i.qty === 1 ? "trash" : "minus", 19)}</button><span>${i.qty}</span><button data-act="cinc" data-k="${idx}" aria-label="+">${icon("plus", 19)}</button></div></div></div></div>`;
    }).join("");
    const currency = (find(S.cart[0].id) || {}).currency || "";
    const f = (id, label, input, msg) => `<div class="field" id="f-${id}"><label for="${id}">${esc(label)}</label>${input}<div class="msg">${esc(msg || "")}</div></div>`;
    return {
      cta: `<div class="in"><div class="price"><small>${esc(t("total"))}</small><b id="ctaTotal">${esc(fmt(localSub()))} ${esc(currency)}</b></div><button class="btn" id="go" type="submit" form="of">${esc(t("order"))}</button></div>`,
      html: `${topbar(esc(t("cart")), `<button class="tlink danger" data-act="clearcart">${esc(t("clear"))}</button>`)}
${sh.deliveryFee && sh.freeFrom ? `<div class="section"><div class="card freebar" id="freebar"></div></div>` : ""}
<div class="section"><div class="card">${rows}</div></div>
<div class="section"><div class="card"><button class="promo-row" data-act="promo-toggle">${icon("percent", 20)}<span style="flex:1">${esc(t("promoQ"))}</span>${icon(S.promoOpen || S.promo ? "down" : "chev", 18)}</button>
<div id="promobox" ${S.promoOpen || S.promo ? "" : "hidden"}><div class="promo-form"><input class="input" id="promo" placeholder="${esc(t("promo"))}" value="${esc(S.promo)}" autocapitalize="characters" autocomplete="off"><button class="btn secondary" data-act="promo-apply">${esc(t("apply"))}</button></div><div class="pmsg" id="pmsg"></div></div></div></div>
<div class="section"><div class="card sum" id="sum"></div></div>
<form id="of" class="section" novalidate><div class="card"><h2>${icon("user", 18)} ${esc(t("yourData"))}</h2>
${f("n", t("name"), `<input class="input" id="n" name="name" autocomplete="name" maxlength="80" value="${esc(u.name || [tu.first_name, tu.last_name].filter(Boolean).join(" "))}">`, t("errName"))}
${f("p", t("phone"), `<input class="input" id="p" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998 90 123 45 67" maxlength="30" value="${esc(u.phone || "")}">`, t("errPhone"))}</div>
<div class="card"><h2>${icon("truck", 18)} ${esc(t("delivSec"))}</h2>
${f("a", t("addr"), `<input class="input" id="a" name="address" autocomplete="street-address" maxlength="200" placeholder="${esc(t("addrPh"))}" value="${esc(u.address || "")}">`)}
${f("o", t("note"), `<textarea class="input" id="o" name="note" maxlength="300" rows="2"></textarea>`)}</div></form>`,
      mount() { paintSummary(); refreshQuote(); },
    };
  }
  function paintSummary() {
    const sum = $("#sum"); if (!sum) return;
    const q = S.quote, sh = S.data.shop;
    let html = "", short = false;
    if (q && q.currency) {
      const c = q.currency;
      html = `<div class="sumrow"><span>${esc(t("sub"))}</span><span>${esc(money(q.subtotal, c))}</span></div>` +
        (q.discount ? `<div class="sumrow ok"><span>${esc(t("disc"))} (${q.promoPercent}%)</span><span>−${esc(money(q.discount, c))}</span></div>` : "") +
        (sh.deliveryFee ? `<div class="sumrow"><span>${esc(t("deliv"))}</span><span>${q.delivery ? esc(money(q.delivery, c)) : esc(t("free"))}</span></div>` : "") +
        `<div class="sumrow tot"><span>${esc(t("total"))}</span><span>${esc(q.text)}</span></div>`;
      const after = q.subtotal - q.discount;
      short = q.minOrder > 0 && after < q.minOrder;
      if (short) html += `<div class="minnote">${icon("info", 18)}<span>${esc(t("minLeft", { n: money(q.minOrder, c), m: money(q.minOrder - after, c) }))}</span></div>`;
      const fb = $("#freebar");
      if (fb && sh.freeFrom) {
        const left = sh.freeFrom - after, done = left <= 0;
        fb.className = "card freebar" + (done ? " reached" : "");
        fb.innerHTML = `<p>${esc(done ? t("freeDone") : t("freeLeft", { n: money(left, c) }))}</p><div class="prog"><i style="width:${Math.max(4, Math.min(100, Math.round((after / sh.freeFrom) * 100)))}%"></i></div>`;
      }
      const ct = $("#ctaTotal"); if (ct) ct.textContent = q.text;
    } else {
      html = `<div class="sumrow tot"><span>${esc(t("total"))}</span><span>${q ? esc(q.text || t("agree")) : '<span class="sk" style="display:inline-block;width:110px;height:20px"></span>'}</span></div>`;
    }
    sum.innerHTML = html;
    const go = $("#go"); if (go) go.classList.toggle("off", short);
    const pm = $("#pmsg");
    if (pm) pm.innerHTML = S.promo && q ? (q.promoOk ? `<span class="pmsg ok">✓ ${esc(t("promoOk"))}: −${q.promoPercent}%</span>` : `<span class="pmsg bad">${esc(t("promoBad"))}</span>`) : "";
  }
  let qTimer;
  function refreshQuote() {
    clearTimeout(qTimer);
    qTimer = setTimeout(async () => {
      if (route().name !== "cart" || !S.cart.length) return;
      const r = await api("/api/quote", { slug, items: S.cart.map((i) => ({ id: i.id, qty: i.qty, size: i.size || "" })), promo: S.promo });
      if (r.ok && route().name === "cart") { S.quote = r.j; paintSummary(); }
    }, 100);
  }
  const bump = () => { saveCart(); renderTabs(); };

  async function submitOrder(e) {
    e.preventDefault();
    const name = $("#n").value.trim(), phone = $("#p").value.trim(), digits = phone.replace(/\D/g, "");
    $("#f-n").classList.toggle("err", name.length < 2);
    $("#f-p").classList.toggle("err", digits.length < 9 || digits.length > 15);
    const bad = $(".field.err"); if (bad) { bad.scrollIntoView({ block: "center", behavior: "smooth" }); haptic("err"); bad.querySelector("input").focus({ preventScroll: true }); return; }
    const b = $("#go"); b.classList.add("loading");
    const lines = S.cart.map((i) => ({ id: i.id, qty: i.qty, size: i.size || "" }));
    const r = await api("/api/orders", { slug, items: lines, promo: S.promo, name, phone, address: $("#a").value.trim(), note: $("#o").value.trim() }, tgHeaders());
    b.classList.remove("loading");
    if (r.status === 409) return toast(`${t("oos")} ${r.j.title}${r.j.size ? " (" + r.j.size + ")" : ""} — ${r.j.have}`, "err");
    if (r.j.error === "bad_promo") return toast(t("promoBad"), "err");
    if (r.j.error === "min_order") return toast(t("minOrder") + ": " + fmt(r.j.min), "err");
    if (!r.ok) return toast(t("err"), "err");
    S.me = { name, phone, address: $("#a").value.trim() }; store.set("u:" + slug, S.me);
    S.done = Object.assign({}, r.j, { count: cartCount() });
    S.cart = []; S.promo = ""; S.quote = null; saveCart();
    haptic("ok");
    try { if (tg && tg.requestWriteAccess && !(tg.initDataUnsafe.user && tg.initDataUnsafe.user.allows_write_to_pm)) tg.requestWriteAccess(); } catch {}
    stack.length = 0; stack.push("#/", "#/done"); location.replace("#/done");
  }

  // ------------------------------------------------------------------ done / orders / info
  function viewDone() {
    const d = S.done;
    if (!d) return { html: `${topbar("")}${emptyState("receipt", t("noOrders"), "", `<button class="btn" data-act="home">${esc(t("toCatalog"))}</button>`)}` };
    return {
      html: `${topbar(esc(t("placed")))}
<div class="done"><svg class="check-anim okc" viewBox="0 0 88 88" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="44" cy="44" r="40"/><path d="M27 45l12 12 23-25"/></svg>
<h1>${esc(t("placed"))}</h1><p class="muted">${esc(t("orderNo"))}: <b>#${d.id}</b> · ${esc(d.total)}</p></div>
${d.payment ? `<div class="section"><div class="card"><h2>${icon("card", 18)} ${esc(t("pay"))}</h2><p style="white-space:pre-line">${esc(d.payment)}</p><button class="btn secondary sm" style="margin-top:12px" data-act="copy" data-v="${esc(d.payment)}">${icon("copy", 17)} ${esc(t("copy"))}</button></div></div>` : ""}
<div class="section"><div class="card"><h2>${esc(t("next"))}</h2><div class="steps">${["st1", "st2", "st3"].map((k, i) => `<div class="s"><div class="n">${i + 1}</div><div>${esc(t(k))}</div></div>`).join("")}</div></div></div>
<div class="section" style="display:flex;flex-direction:column;gap:10px"><a class="btn secondary block" href="#/orders">${icon("receipt", 20)} ${esc(t("myOrders"))}</a><button class="btn block" data-act="home">${esc(t("toCatalog"))}</button></div>`,
    };
  }
  const stepIdx = { new: 0, confirmed: 1, shipped: 2 };
  function orderCard(o) {
    const cancelled = o.status === "cancelled", idx = stepIdx[o.status] ?? 0;
    const cls = { new: "soft", confirmed: "ok", shipped: "ok", cancelled: "bad" }[o.status] || "gray";
    return `<div class="card ocard"><div class="oh"><b>#${o.id}</b><span class="badge ${cls}">${esc(t("s_" + o.status))}</span></div><div class="faint small">${esc(ago(o.created_at))}</div>
<ul>${o.items.map((i) => `<li>${esc(i.title)}${i.size ? ` (${esc(i.size)})` : ""} × ${i.qty}</li>`).join("")}</ul>
${cancelled ? "" : `<div class="tl">${[0, 1, 2].map((k) => `${k ? `<div class="ln ${idx >= k ? "on" : ""}"></div>` : ""}<div class="d ${idx >= k ? "on" : ""}"></div>`).join("")}</div><div class="tll">${["s_new", "s_confirmed", "s_shipped"].map((k, i) => `<span class="${idx === i ? "on" : ""}">${esc(t(k))}</span>`).join("")}</div>`}
<div class="sumrow tot" style="margin-top:12px"><span>${esc(t("total"))}</span><span>${esc(o.total)}</span></div></div>`;
  }
  function viewOrders() {
    return {
      html: `${topbar(esc(t("myOrders")))}<div class="section" id="olist"><div class="card"><div class="sk" style="height:90px"></div></div></div>`,
      async mount() {
        const box = $("#olist");
        if (!tg || !tg.initData) { box.outerHTML = emptyState("receipt", t("noOrders"), t("ordersTg")); return; }
        const r = await api("/api/my-orders?slug=" + encodeURIComponent(slug), null, tgHeaders());
        const list = $("#olist"); if (!list || route().name !== "orders") return;
        if (!r.ok || !r.j.orders || !r.j.orders.length) { list.outerHTML = emptyState("receipt", t("noOrders"), t("noOrdersSub"), `<button class="btn" data-act="home">${esc(t("toCatalog"))}</button>`); return; }
        list.innerHTML = r.j.orders.map(orderCard).join("");
      },
    };
  }
  function viewInfo() {
    const s = S.data.shop, c = (s.contact || "").trim();
    const tel = (v) => `tel:${String(v).replace(/[^\d+]/g, "")}`;
    const href = /^@\w+$/.test(c) ? `https://t.me/${c.slice(1)}` : /^\+?[\d\s()-]{7,}$/.test(c) ? tel(c) : "";
    const del = [];
    if (s.deliveryFee) del.push(s.freeFrom ? t("feeFrom", { a: fmt(s.deliveryFee), b: fmt(s.freeFrom) }) : fmt(s.deliveryFee));
    if (s.minOrder) del.push(`${t("minOrder")}: ${fmt(s.minOrder)}`);
    const row = (ic, ttl, sub, extra, tag = "button") => `<${tag} class="row" ${extra}><span class="ric">${icon(ic, 20)}</span><span class="rt"><b>${esc(ttl)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</span><span class="chev">${icon("chev", 18)}</span></${tag}>`;
    return {
      html: `${topbar(esc(t("shop")))}
<div class="section"><div class="card shophead"><div class="avatar lg">${esc(initial(s.name))}</div><div><h2>${esc(s.name)}</h2>${s.about ? `<p>${esc(s.about)}</p>` : ""}</div></div></div>
<div class="group-title">${esc(t("myOrders"))}</div><div class="list">${row("receipt", t("myOrders"), "", 'href="#/orders"', "a")}</div>
<div class="group-title">${esc(t("contact"))}</div><div class="list">
${href ? row("send", t("contact"), c, `href="${esc(href)}"`, "a") : ""}${s.phones.map((p) => row("phone", t("phones"), p, `href="${esc(tel(p))}"`, "a")).join("")}
${s.address ? row("pin", t("address"), s.address, `data-act="copy" data-v="${esc(s.address)}"`) : ""}</div>
${del.length ? `<div class="group-title">${esc(t("terms"))}</div><div class="list">${row("truck", t("deliv"), del.join(" · "), 'data-act="noop"')}</div>` : ""}
<div class="group-title">${esc(t("language"))}</div><div class="list">${row("globe", t("language"), { uz: "O'zbekcha", ru: "Русский", en: "English" }[S.lang], 'data-act="lang"')}
${s.link ? row("share", t("share"), "", `data-act="copy" data-v="${esc(s.link)}"`) : ""}</div>` };
  }

  // ------------------------------------------------------------------ sheets
  function langSheet() {
    sheet({ title: t("chooseLang"), html: ["uz", "ru", "en"].map((l) => `<button class="opt ${S.lang === l ? "on" : ""}" data-act="setlang" data-v="${l}">${{ uz: "O'zbekcha", ru: "Русский", en: "English" }[l]}<span class="tick">${icon("check", 20)}</span></button>`).join("") });
  }
  function sortSheet() {
    sheet({ title: t("sort"), html: [["new", "sortNew"], ["low", "sortLow"], ["high", "sortHigh"], ["sale", "sortSale"]].map(([v, k]) => `<button class="opt ${S.sort === v ? "on" : ""}" data-act="setsort" data-v="${v}">${esc(t(k))}<span class="tick">${icon("check", 20)}</span></button>`).join("") });
  }

  // ------------------------------------------------------------------ render
  const views = { home: viewHome, p: viewProduct, fav: viewFav, cart: viewCart, info: viewInfo, orders: viewOrders, done: viewDone };
  function renderTabs(hide) {
    const r = route().name, cc = cartCount();
    const tab = (href, key, ic, label, badge) => `<a href="${href}" data-tab class="${(r === key || (key === "info" && r === "orders")) ? "on" : ""}">${icon(ic, 24)}<span>${esc(label)}</span>${badge ? `<i class="dot">${badge}</i>` : ""}</a>`;
    tabs.innerHTML = `<div class="in">${tab("#/", "home", "grid", t("catalog"))}${tab("#/fav", "fav", "heart", t("favs"), S.favs.length || "")}${tab("#/cart", "cart", "cart", t("cart"), cc || "")}${tab("#/info", "info", "store", t("shop"))}</div>`;
    tabs.hidden = !!hide;
  }
  function render(keepScroll) {
    if (!S.data) return;
    const r = route();
    if (!keepScroll) $("#toast").classList.remove("show");
    if (S.prev === "home" && r.name !== "home" && !keepScroll) S.homeScroll = window.scrollY;
    if (r.name === "p" && S.prev !== "p") { const inCart = S.cart.find((i) => i.id === r.id); S.size = inCart ? inCart.size || "" : ""; }
    const v = (views[r.name] || viewHome)(r);
    app.innerHTML = `<div class="page${keepScroll ? " still" : ""}">${v.html}</div>`;
    cta.hidden = !v.cta; cta.innerHTML = v.cta || "";
    document.body.classList.toggle("has-cta", !!v.cta); app.classList.toggle("has-cta", !!v.cta);
    renderTabs(!!v.cta);
    document.documentElement.lang = S.lang; document.title = S.data.shop.name;
    if (v.mount) v.mount();
    if (!keepScroll) { r.name === "home" && S.prev && S.prev !== "home" ? window.scrollTo(0, S.homeScroll) : window.scrollTo(0, 0); }
    S.prev = r.name;
    if (tg) { r.name === "home" ? tg.BackButton.hide() : tg.BackButton.show(); }
  }

  // ------------------------------------------------------------------ events
  const setFav = (id) => {
    S.favs = S.favs.includes(id) ? S.favs.filter((x) => x !== id) : S.favs.concat(id); saveFavs(); haptic("light");
    $$(`[data-act="fav"][data-id="${id}"]`).forEach((b) => b.classList.toggle("on", S.favs.includes(id)));
    if (route().name === "fav") render(true); else renderTabs(!cta.hidden);
  };
  async function share(p) {
    const link = S.data.shop.link ? `${S.data.shop.link}__p${p.id}` : `${location.origin}/s/${slug}#/p/${p.id}`;
    if (tg && tg.openTelegramLink && S.data.shop.link) tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(title(p)));
    else if (navigator.share) navigator.share({ title: title(p), url: link }).catch(() => {});
    else copy(link, t("linkCopied"));
  }
  document.addEventListener("click", async (e) => {
    const tab = e.target.closest("a[data-tab]");
    if (tab) {
      e.preventDefault(); const h = tab.getAttribute("href");
      stack.length = 0; stack.push("#/"); if (h !== "#/") stack.push(h);
      if (curHash() === h) render(); else location.replace(h);
      return;
    }
    const el = e.target.closest("[data-act]"); if (!el) return;
    const a = el.dataset.act, v = el.dataset.v;
    if (a === "back") return back();
    if (a === "home") { stack.length = 0; stack.push("#/"); return curHash() === "#/" ? render() : location.replace("#/"); }
    if (a === "fav") { e.preventDefault(); e.stopPropagation(); return setFav(Number(el.dataset.id)); }
    if (a === "lang") return langSheet();
    if (a === "setlang") { S.lang = v; store.set("lang", v); closeLayer(); return render(true); }
    if (a === "sort") return sortSheet();
    if (a === "setsort") { S.sort = v; closeLayer(); return drawGrid(); }
    if (a === "cat") { S.cat = v; $$(".chip").forEach((c) => c.classList.toggle("on", c.dataset.v === S.cat)); return drawGrid(); }
    if (a === "reset") { S.cat = ""; S.q = ""; S.sort = "new"; return render(true); }
    if (a === "crumb") { e.preventDefault(); S.cat = v; stack.length = 0; stack.push("#/"); return curHash() === "#/" ? render() : location.replace("#/"); }
    if (a === "share") return share(find(route().id));
    if (a === "copy") return copy(v, t("copied"));
    if (a === "size") {
      S.size = v; $$(".sz").forEach((c) => c.classList.toggle("on", c.dataset.v === v)); const ss = $("#szsel"); if (ss) ss.textContent = v;
      $("#sizeblock") && $("#sizeblock").classList.remove("need"); haptic("light"); return refreshCta();
    }
    if (a === "add") {
      const p = find(route().id);
      if (p.sizes.length && !S.size) { const b = $("#sizeblock"); b.classList.add("need", "shake"); setTimeout(() => b.classList.remove("shake"), 450); b.scrollIntoView({ block: "center", behavior: "smooth" }); haptic("warn"); return toast(t("pickSize"), "err"); }
      S.cart.push({ id: p.id, size: S.size, qty: 1 }); bump(); haptic("ok"); toast(t("added"), "ok"); return refreshCta();
    }
    if (a === "inc" || a === "dec") {
      const p = find(route().id), line = lineFor(p); if (!line) return;
      line.qty += a === "inc" ? 1 : -1; if (line.qty > 20) line.qty = 20;
      if (line.qty < 1) S.cart = S.cart.filter((i) => lineKey(i) !== lineKey(line));
      bump(); haptic("light"); return refreshCta();
    }
    if (a === "go-cart") { location.hash = "#/cart"; return; }
    if (a === "cinc" || a === "cdec") {
      const i = S.cart[Number(el.dataset.k)]; if (!i) return;
      i.qty += a === "cinc" ? 1 : -1; if (i.qty > 20) i.qty = 20;
      if (i.qty < 1) S.cart.splice(Number(el.dataset.k), 1);
      bump(); haptic("light"); S.quote = null; return render(true);
    }
    if (a === "clearcart") { if (await confirmDialog({ title: t("clearAsk"), ok: t("clearOk"), cancel: t("close"), danger: true })) { S.cart = []; S.promo = ""; S.quote = null; bump(); render(true); } return; }
    if (a === "promo-toggle") { S.promoOpen = !S.promoOpen; $("#promobox").hidden = !S.promoOpen; if (S.promoOpen) $("#promo").focus(); return; }
    if (a === "promo-apply") { S.promo = $("#promo").value.trim(); S.quote = null; paintSummary(); return refreshQuote(); }
    if (a === "ask") return ask(v);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "q") { S.q = e.target.value; drawGrid(); }
    if (e.target.closest && e.target.closest(".field.err")) e.target.closest(".field").classList.remove("err");
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "askf") { e.preventDefault(); const i = $("#askq"); const v = i.value; i.value = ""; ask(v); }
    else if (e.target.id === "of") submitOrder(e);
  });
  if (tg) tg.BackButton.onClick(back);

  // ------------------------------------------------------------------ boot
  (async () => {
    app.innerHTML = `<header class="topbar home"><div class="sk" style="width:40px;height:40px"></div><div class="sk" style="flex:1;height:22px"></div></header><div class="pgrid" style="padding-top:70px">${'<div class="sk" style="aspect-ratio:4/5.6"></div>'.repeat(4)}</div>`;
    if (!slug) { app.innerHTML = emptyState("store", "Savia", ""); return; }
    const r = await api("/api/shop/" + encodeURIComponent(slug));
    if (!r.ok) { app.innerHTML = emptyState("store", t("notFound"), t("notFoundSub")); return; }
    S.data = r.j; applyAccent(r.j.shop.accent);
    S.cart = S.cart.filter((i) => find(i.id));
    const m = /__p(\d+)/.exec(startParam);
    if (m && curHash() === "#/") { stack.push("#/p/" + m[1]); location.hash = "#/p/" + m[1]; return; }
    render();
    if (tg && tg.initData) api("/api/visit", { slug }, tgHeaders());
  })();
})();
