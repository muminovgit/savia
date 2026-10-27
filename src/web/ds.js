/* Savia design system helpers shared by the buyer Mini App and the seller panel */
window.DS = (() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n);

  const P = {
    back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', close: '<path d="M18 6L6 18M6 6l12 12"/>',
    heart: '<path d="M20.8 5.6a5.2 5.2 0 00-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 00-7.4 7.4l1.4 1.4L12 21.8l7.4-7.4 1.4-1.4a5.2 5.2 0 000-7.4z"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3.5h3l2.4 11.3a1.6 1.6 0 001.6 1.2h8.2a1.6 1.6 0 001.6-1.2L21 7.5H6"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    store: '<path d="M3 9l1.6-5h14.8L21 9M3 9v11h18V9M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    sort: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    send: '<path d="M21.5 3L2.5 10.5l6.5 3 3 6.5 3.2-5.2L21.5 3z"/><path d="M9 13.5L21.5 3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="16.5" cy="18" r="1.8"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3A9 9 0 0012 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18.5 15c1.6.7 2.6 2.3 3 5"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>', percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>', bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>', megaphone: '<path d="M3 10v4h3l8 4V6L6 10z"/><path d="M18 9a4 4 0 010 6"/>', alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  };
  const icon = (n, size = 22, cls = "") =>
    `<svg class="i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

  // ---- brand colour ----
  const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mix = (c, t, k) => c.map((v, i) => Math.round(v + (t[i] - v) * k));
  function applyAccent(hex) {
    const rgb = hexRgb(hex);
    const root = document.documentElement.style;
    if (!rgb) { ["--accent", "--accent-ink", "--accent-soft", "--on-accent"].forEach((k) => root.removeProperty(k)); return; }
    const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.setProperty("--accent", "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""));
    root.setProperty("--on-accent", lum(rgb) > 0.5 ? "#101615" : "#ffffff");
    root.setProperty("--accent-soft", `rgba(${rgb.join(",")},${dark ? 0.2 : 0.11})`);
    root.setProperty("--accent-ink", `rgb(${(dark ? mix(rgb, [255, 255, 255], 0.55) : mix(rgb, [0, 0, 0], 0.18)).join(",")})`);
  }

  /** CSS custom properties for a brand colour, for scoping a preview to one element. */
  function accentVars(hex) {
    const rgb = hexRgb(hex) || hexRgb("#0f766e");
    const h = "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
    return `--accent:${h};--on-accent:${lum(rgb) > 0.5 ? "#101615" : "#ffffff"};--accent-soft:rgba(${rgb.join(",")},.12);--accent-ink:rgb(${mix(rgb, [0, 0, 0], 0.18).join(",")})`;
  }

  // ---- theme / telegram ----
  if (tg) {
    tg.ready(); tg.expand();
    document.documentElement.dataset.theme = tg.colorScheme === "dark" ? "dark" : "light";
    try { tg.setHeaderColor && tg.setHeaderColor("bg_color"); } catch {}
  }
  const haptic = (kind = "light") => { try { if (!tg || !tg.HapticFeedback) return; kind === "ok" || kind === "err" || kind === "warn" ? tg.HapticFeedback.notificationOccurred({ ok: "success", err: "error", warn: "warning" }[kind]) : tg.HapticFeedback.impactOccurred(kind); } catch {} };

  // ---- toast ----
  let tt;
  function toast(msg, type = "") {
    const el = $("#toast"); if (!el) return;
    el.className = type;
    el.innerHTML = (type === "ok" ? icon("check", 18) : type === "err" ? icon("alert", 18) : "") + `<span>${esc(msg)}</span>`;
    void el.offsetWidth; el.classList.add("show");
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 2200);
    if (type) haptic(type);
  }

  // ---- sheet & confirm ----
  const layer = () => { let l = $("#layer"); if (!l) { l = document.createElement("div"); l.id = "layer"; document.body.appendChild(l); } return l; };
  function closeLayer() { layer().innerHTML = ""; document.body.style.overflow = ""; }
  function sheet({ title, html, onMount }) {
    layer().innerHTML = `<div class="ov" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div><header><h2>${esc(title)}</h2><button class="ib" data-close aria-label="Yopish">${icon("close")}</button></header><div class="body">${html}</div></div>`;
    document.body.style.overflow = "hidden";
    layer().querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeLayer));
    if (onMount) onMount(layer().querySelector(".sheet"));
  }
  function confirmDialog({ title, text, ok = "OK", cancel = "Bekor qilish", danger = false }) {
    return new Promise((resolve) => {
      layer().innerHTML = `<div class="ov" data-no></div><div class="dialog" role="alertdialog"><h3>${esc(title)}</h3><p class="muted">${esc(text || "")}</p><div class="btns"><button class="btn ghost" data-no>${esc(cancel)}</button><button class="btn ${danger ? "danger" : ""}" id="dlg-ok">${esc(ok)}</button></div></div>`;
      const done = (v) => { closeLayer(); resolve(v); };
      layer().querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => done(false)));
      $("#dlg-ok").onclick = () => done(true);
    });
  }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || "Nusxalandi", "ok"); }
    catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); toast(okMsg || "Nusxalandi", "ok"); } catch {} t.remove(); }
  }
  const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();
  const ago = (s) => { const d = new Date(String(s).replace(" ", "T") + "Z"); if (isNaN(d)) return ""; const z = (n) => String(n).padStart(2, "0"); return `${z(d.getDate())}.${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`; };

  return { tg, $, $$, esc, fmt, icon, applyAccent, accentVars, haptic, toast, sheet, closeLayer, confirmDialog, copy, initial, ago };
})();
