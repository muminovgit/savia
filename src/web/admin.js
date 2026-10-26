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
  const toast = (m) => { const el = $("#toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1900); };

  const api = async (path, method, body) => {
    const r = await fetch("/api/admin" + path, {
      method: method || "GET",
      headers: { "content-type": "application/json", "x-tg-init": (tg && tg.initData) || "" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let j = {}; try { j = await r.json(); } catch {}
    if (r.status === 401) throw new Error("auth");
    if (!r.ok) throw new Error(j.error || "error");
    return j;
  };

  const TABS = [["home", "Bosh sahifa"], ["products", "Mahsulotlar"], ["orders", "Buyurtmalar"], ["settings", "Sozlamalar"]];
  const ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
    products: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    orders: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  };
  const S = { tab: (location.hash.replace("#/", "") || "home"), orderFilter: "new", q: "", products: [], categories: [] };
  const STATUS = { new: "Yangi", confirmed: "Tasdiqlangan", shipped: "Yuborilgan", cancelled: "Bekor" };

  function drawTabs(newOrders) {
    $("#tabs").innerHTML = TABS.map(([k, l]) => `<a href="#/${k}" class="${S.tab === k ? "on" : ""}">${ICON[k]}${k === "orders" && newOrders ? `<span class="dot">${newOrders}</span>` : ""}<span>${l}</span></a>`).join("");
  }
  const stockText = (st) => (st ? Object.entries(st).map(([k, q]) => (k === "_" ? `jami ${q}` : `${k}: ${q}`)).join(", ") : "");
  const priceText = (p) => (p.price == null ? "narx yo'q" : fmt(p.price) + " " + p.currency);

  // ---------- Home ----------
  async function home() {
    const d = await api("/overview");
    drawTabs(d.stats.ordersNew);
    const b = d.stats.buyers;
    $("#app").innerHTML = `<h1>${esc(d.shop.name)}</h1><div class="sub">Sotuvchi paneli</div>
<div class="stats">
<a class="stat ${d.stats.ordersNew ? "hot" : ""}" href="#/orders"><b>${d.stats.ordersNew}</b><span>Yangi buyurtma</span></a>
<a class="stat" href="#/products"><b>${d.stats.products}</b><span>Mahsulot</span></a>
<div class="stat"><b>${d.stats.ordersTotal}</b><span>Jami buyurtma</span></div>
<div class="stat"><b>${b.reachable || 0}<small style="font-size:14px;font-weight:400"> / ${b.total || 0}</small></b><span>Xaridor (xabar olishi mumkin)</span></div></div>
<div class="box"><h3>Do'kon linki</h3><p style="word-break:break-all;margin:0 0 10px">${esc(d.url)}</p>
<div class="btns"><button class="btn sm" id="copy">Nusxalash</button><a class="btn sm ghost" style="text-align:center" href="${esc(d.url)}">Ko'rish</a></div></div>
${d.low.length ? `<div class="box"><h3>Qoldiq kam</h3>${d.low.map((p) => `<div class="prm" data-edit="${p.id}" style="cursor:pointer"><span>${esc(p.title)}</span><span class="tag red">${esc(stockText(p.stock))}</span></div>`).join("")}</div>` : ""}
<p class="hint">Rassilka uchun botda: /broadcast. Kanalni ulash: /channel.</p>`;
    $("#copy").onclick = () => { navigator.clipboard && navigator.clipboard.writeText(d.url); toast("Nusxalandi"); };
    document.querySelectorAll("[data-edit]").forEach((el) => (el.onclick = () => openEditor(Number(el.dataset.edit))));
  }

  // ---------- Products ----------
  async function loadProducts() {
    const d = await api("/products");
    S.products = d.products; S.categories = d.categories;
  }
  function productRows() {
    const q = S.q.trim().toLowerCase();
    const items = S.products.filter((p) => !q || [p.translations.uz.title, p.category, ...Object.values(p.attributes)].join(" ").toLowerCase().includes(q));
    return items.length ? items.map((p) => `<div class="prow" data-edit="${p.id}">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : '<div class="noimg"></div>'}
<div class="t"><div>${esc(p.translations.uz.title)}</div><div class="m">${esc(priceText(p))}${p.oldPrice ? ` <s>${esc(fmt(p.oldPrice))}</s>` : ""} · ${esc(p.category || "kategoriyasiz")}</div>
<div class="m">${p.stock ? (p.soldOut ? '<span class="tag red">Tugadi</span>' : `<span class="tag green">${esc(stockText(p.stock))}</span>`) : "qoldiq kuzatilmaydi"}</div></div></div>`).join("") : '<div class="empty">Mahsulot yo\'q</div>';
  }
  async function products() {
    await loadProducts();
    drawTabs();
    $("#app").innerHTML = `<h1>Mahsulotlar</h1><input class="search" id="pq" placeholder="Qidirish" value="${esc(S.q)}"><div id="plist">${productRows()}</div>
<p class="hint">Mahsulot qo'shish: botga rasm yuboring yoki kanalni ulang (/channel).</p>`;
    bindRows();
    $("#pq").oninput = (e) => { S.q = e.target.value; $("#plist").innerHTML = productRows(); bindRows(); };
  }
  const bindRows = () => document.querySelectorAll("[data-edit]").forEach((el) => (el.onclick = () => openEditor(Number(el.dataset.edit))));

  const parseStock = (mode, text) => {
    if (mode === "off") return null;
    if (mode === "total") {
      const n = Number(text.trim());
      if (!Number.isInteger(n) || n < 0) throw new Error("Qoldiq soni noto'g'ri");
      return { _: n };
    }
    const out = {};
    for (const part of text.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean)) {
      const m = /^(\S{1,12})\s*[:=]\s*(\d{1,6})$/.exec(part);
      if (!m) throw new Error(`Noto'g'ri: "${part}". Masalan: 46:3, 48:5`);
      out[m[1]] = Number(m[2]);
    }
    if (!Object.keys(out).length) throw new Error("Razmerlarni kiriting: 46:3, 48:5");
    return out;
  };

  async function openEditor(id) {
    if (!S.products.length) await loadProducts();
    const p = S.products.find((x) => x.id === id);
    if (!p) return toast("Topilmadi");
    const keys = p.stock ? Object.keys(p.stock) : [];
    const mode = !p.stock ? "off" : keys.length === 1 && keys[0] === "_" ? "total" : "sizes";
    const stockVal = mode === "total" ? String(p.stock._) : mode === "sizes" ? keys.map((k) => `${k}:${p.stock[k]}`).join(", ") : "";
    const t = p.translations;
    $("#sheet").innerHTML = `<div class="ov" id="ov"></div><div class="sh">
<h3 style="margin:0 0 12px">#${p.id} ${esc(t.uz.title)}</h3>
<div class="field"><label>Nomi (o'zbekcha)</label><input id="e-tu" maxlength="120" value="${esc(t.uz.title)}"></div>
<div class="field"><label>Tavsif (o'zbekcha)</label><textarea id="e-du" rows="3" maxlength="600">${esc(t.uz.description)}</textarea></div>
<details style="margin-bottom:12px"><summary style="cursor:pointer;color:var(--muted)">Ruscha va inglizcha tarjima</summary>
<div class="field" style="margin-top:8px"><label>Nomi (ruscha)</label><input id="e-tr" maxlength="120" value="${esc(t.ru.title)}"></div>
<div class="field"><label>Tavsif (ruscha)</label><textarea id="e-dr" rows="2" maxlength="600">${esc(t.ru.description)}</textarea></div>
<div class="field"><label>Nomi (inglizcha)</label><input id="e-te" maxlength="120" value="${esc(t.en.title)}"></div>
<div class="field"><label>Tavsif (inglizcha)</label><textarea id="e-de" rows="2" maxlength="600">${esc(t.en.description)}</textarea></div></details>
<div class="field"><label>Narx (${esc(p.currency)})</label><input id="e-price" type="number" inputmode="numeric" min="0" value="${p.price == null ? "" : p.price}"><small>${p.oldPrice ? `Asl narx: ${fmt(p.oldPrice)}. Narxni qo'lda o'zgartirsangiz chegirma bekor bo'ladi.` : ""}</small></div>
<div class="field"><label>Chegirma (%)</label><div class="row2"><input id="e-disc" type="number" inputmode="numeric" min="1" max="90" placeholder="20" style="flex:1"><button class="btn sm" id="e-dapply">Qo'llash</button>${p.oldPrice ? '<button class="btn sm ghost" id="e-doff">Olib tashlash</button>' : ""}</div></div>
<div class="field"><label>Kategoriya</label><input id="e-cat" list="cats" maxlength="30" value="${esc(p.category)}"><datalist id="cats">${S.categories.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
<div class="field"><label>Qoldiq</label><select id="e-mode"><option value="off" ${mode === "off" ? "selected" : ""}>Kuzatilmaydi (cheksiz)</option><option value="total" ${mode === "total" ? "selected" : ""}>Umumiy son</option><option value="sizes" ${mode === "sizes" ? "selected" : ""}>Razmer bo'yicha</option></select>
<input id="e-stock" value="${esc(stockVal)}" placeholder="46:3, 48:5" style="${mode === "off" ? "display:none" : ""}"><small id="e-hint"></small></div>
<div class="btns"><button class="btn" id="e-save">Saqlash</button><button class="btn ghost" id="e-close">Yopish</button></div>
<div class="btns"><button class="btn red sm" id="e-del">O'chirish</button></div></div>`;
    const close = () => { $("#sheet").innerHTML = ""; };
    const hint = () => {
      const m = $("#e-mode").value;
      $("#e-stock").style.display = m === "off" ? "none" : "";
      $("#e-hint").textContent = m === "total" ? "Masalan: 10" : m === "sizes" ? "Razmer:soni, vergul bilan. 0 bo'lsa 'tugagan' ko'rinadi." : "";
    };
    hint();
    $("#e-mode").onchange = hint;
    $("#ov").onclick = close; $("#e-close").onclick = close;
    const act = async (body, msg) => {
      try { await api("/products/" + id, "POST", body); toast(msg); await loadProducts(); close(); await render(); }
      catch (e) { toast(e.message === "bad discount" ? "Chegirma 1–90% bo'lishi kerak" : "Xatolik: " + e.message); }
    };
    $("#e-dapply").onclick = () => { const v = Number($("#e-disc").value); if (!Number.isInteger(v)) return toast("Chegirma foizini kiriting"); act({ discount: v }, "Chegirma qo'yildi"); };
    if ($("#e-doff")) $("#e-doff").onclick = () => act({ discount: null }, "Chegirma olib tashlandi");
    $("#e-save").onclick = () => {
      let stock;
      try { stock = parseStock($("#e-mode").value, $("#e-stock").value); } catch (e) { return toast(e.message); }
      const priceRaw = $("#e-price").value.trim();
      const body = {
        category: $("#e-cat").value,
        translations: { uz: { title: $("#e-tu").value, description: $("#e-du").value }, ru: { title: $("#e-tr").value, description: $("#e-dr").value }, en: { title: $("#e-te").value, description: $("#e-de").value } },
        stock,
      };
      if (priceRaw !== String(p.price == null ? "" : p.price)) body.price = priceRaw === "" ? null : Number(priceRaw);
      act(body, "Saqlandi");
    };
    $("#e-del").onclick = async () => {
      if (!confirm("Mahsulot o'chirilsinmi?")) return;
      try { await api("/products/" + id, "DELETE"); toast("O'chirildi"); await loadProducts(); close(); await render(); } catch (e) { toast("Xatolik"); }
    };
  }

  // ---------- Orders ----------
  async function orders() {
    const d = await api("/orders");
    const all = d.orders;
    drawTabs(all.filter((o) => o.status === "new").length);
    const list = all.filter((o) => o.status === S.orderFilter);
    const actions = { new: [["confirmed", "Tasdiqlash"], ["cancelled", "Bekor qilish"]], confirmed: [["shipped", "Yuborildi"], ["cancelled", "Bekor qilish"]], shipped: [], cancelled: [] };
    $("#app").innerHTML = `<h1>Buyurtmalar</h1><div class="chips" style="padding-top:8px">${Object.entries(STATUS).map(([k, l]) => `<button class="chip ${S.orderFilter === k ? "on" : ""}" data-f="${k}">${l} (${all.filter((o) => o.status === k).length})</button>`).join("")}</div>
${list.length ? list.map((o) => `<div class="ocard"><h4><span>#${o.id} · ${esc(o.name)}</span><span class="tag ${o.status === "new" ? "green" : o.status === "cancelled" ? "red" : ""}">${STATUS[o.status]}</span></h4>
<p><a href="tel:${esc(o.phone.replace(/[^\d+]/g, ""))}">${esc(o.phone)}</a>${o.address ? " · " + esc(o.address) : ""}</p>${o.note ? `<p class="m">${esc(o.note)}</p>` : ""}
<ul>${o.items.map((i) => `<li>${esc(i.title)}${i.size ? ` (${esc(i.size)})` : ""} × ${i.qty}</li>`).join("")}</ul>
${o.discount ? `<p class="m">Chegirma: ${esc(o.discount)}</p>` : ""}${o.delivery ? `<p class="m">Yetkazish: ${esc(o.delivery)}</p>` : ""}
<p><b>${esc(o.total)}</b> <span class="m">· ${esc(o.created_at)}</span></p>
${actions[o.status].length ? `<div class="btns">${actions[o.status].map(([s, l]) => `<button class="btn sm ${s === "cancelled" ? "ghost" : ""}" data-o="${o.id}" data-s="${s}">${l}</button>`).join("")}</div>` : ""}</div>`).join("") : '<div class="empty">Buyurtma yo\'q</div>'}`;
    document.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { S.orderFilter = b.dataset.f; orders(); }));
    document.querySelectorAll("[data-o]").forEach((b) => (b.onclick = async () => {
      if (b.dataset.s === "cancelled" && !confirm("Buyurtma bekor qilinsinmi? Qoldiq qaytariladi.")) return;
      b.disabled = true;
      try { await api(`/orders/${b.dataset.o}/status`, "POST", { status: b.dataset.s }); toast("Xaridorga xabar yuborildi"); orders(); } catch { toast("Xatolik"); b.disabled = false; }
    }));
  }

  // ---------- Settings ----------
  async function settings() {
    const d = await api("/settings");
    drawTabs();
    const s = d.settings;
    const field = (id, label, val, extra) => `<div class="field"><label>${label}</label><input id="s-${id}" value="${esc(val)}" ${extra || ""}></div>`;
    $("#app").innerHTML = `<h1>Sozlamalar</h1>
<form class="box" id="sf"><h3>Do'kon</h3>${field("name", "Do'kon nomi", s.name, "maxlength=60 required")}
<div class="field"><label>Tavsif</label><textarea id="s-about" rows="2" maxlength="300">${esc(s.about)}</textarea></div>
${field("contact", "Aloqa (@username yoki telefon)", s.contact, "maxlength=80")}${field("phones", "Telefonlar (vergul bilan, 3 tagacha)", s.phones.join(", "))}${field("address", "Manzil", s.address, "maxlength=200")}
<div class="field"><label>To'lov ma'lumoti (buyurtmadan keyin ko'rsatiladi)</label><input id="s-payment" maxlength="200" value="${esc(s.payment)}" placeholder="Karta 8600 ... yoki Naqd pul"></div>
<h3>Yetkazib berish</h3>${field("fee", "Yetkazish narxi (0 = bepul)", s.deliveryFee, 'type="number" inputmode="numeric" min="0"')}
${field("free", "Shu summadan boshlab bepul (0 = yo'q)", s.freeFrom, 'type="number" inputmode="numeric" min="0"')}${field("min", "Minimal buyurtma (0 = yo'q)", s.minOrder, 'type="number" inputmode="numeric" min="0"')}
<button class="btn full">Saqlash</button></form>
<div class="box"><h3>Promokodlar</h3><div id="promos"></div>
<div class="row2" style="margin-top:10px"><input id="pc" placeholder="KOD" maxlength="20" style="flex:1"><input id="pp" type="number" inputmode="numeric" placeholder="%" min="1" max="90" style="width:80px"><button class="btn sm" id="padd">Qo'shish</button></div></div>
<p class="hint">Banner qo'shish: botga rasm yuboring va izohga /banner yozing.</p>`;
    const drawPromos = (list) => {
      $("#promos").innerHTML = list.length ? list.map((p) => `<div class="prm"><span><b>${esc(p.code)}</b> ${p.percent}% · ${p.uses} marta ${p.active ? "" : '<span class="tag">o\'chiq</span>'}</span>${p.active ? `<button class="btn sm ghost" data-off="${esc(p.code)}">O'chirish</button>` : ""}</div>`).join("") : '<div class="m">Promokod yo\'q</div>';
      document.querySelectorAll("[data-off]").forEach((b) => (b.onclick = async () => drawPromos((await api(`/promos/${encodeURIComponent(b.dataset.off)}/off`, "POST", {})).promos)));
    };
    drawPromos(d.promos);
    $("#padd").onclick = async () => {
      try { drawPromos((await api("/promos", "POST", { code: $("#pc").value, percent: Number($("#pp").value) })).promos); $("#pc").value = ""; $("#pp").value = ""; toast("Promokod saqlandi"); }
      catch { toast("Kod 2–20 harf/raqam, foiz 1–90"); }
    };
    $("#sf").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("/settings", "POST", {
          name: $("#s-name").value, about: $("#s-about").value, contact: $("#s-contact").value, address: $("#s-address").value, payment: $("#s-payment").value,
          phones: $("#s-phones").value.split(",").map((x) => x.trim()).filter(Boolean),
          deliveryFee: Number($("#s-fee").value || 0), freeFrom: Number($("#s-free").value || 0), minOrder: Number($("#s-min").value || 0),
        });
        toast("Saqlandi");
      } catch { toast("Xatolik, qayta urinib ko'ring"); }
    };
  }

  async function render() {
    const k = (location.hash.replace("#/", "") || "home");
    S.tab = TABS.some(([t]) => t === k) ? k : "home";
    if (!tg || !tg.initData) { $("#app").innerHTML = '<div class="empty">Bu panelni Telegram ichida oching: botda /panel</div>'; return; }
    try {
      await ({ home, products, orders, settings }[S.tab])();
      drawTabsActive();
      window.scrollTo(0, 0);
    } catch (e) {
      $("#app").innerHTML = e.message === "auth" ? '<div class="empty">Ruxsat yo\'q. Avval botda /start yuboring (do\'kon egasi yoki menejer bo\'lishingiz kerak).</div>' : '<div class="empty">Xatolik. Qayta urinib ko\'ring.</div>';
    }
  }
  const drawTabsActive = () => document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#/" + S.tab));
  window.addEventListener("hashchange", render);
  render();
})();
