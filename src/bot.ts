import { Bot, InlineKeyboard } from "grammy";
import type { Api } from "grammy";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DATA_DIR, broadcastTargets, broadcastsToday, buyerCounts, logBroadcast, markBuyerBlocked, upsertBuyer, acceptInvite, createInvite, getPromo, getShopBySlug, listPromos, removeAdmin, savePromo, setCategory, setDiscount, setPromoActive, shopAdminIds, shopBanners, shopCategories, shopPhones, isSoldOut, markButton, setStock, addProduct, deleteProduct, getOrCreateShop, getOrder, getOrderItems, getProduct, getShopByChannel, listOrders, productBySource, setShopChannel, listProducts, setOrderStatus, updateProductPhotos, updateShop } from "./db.js";
import { enhance, hasRemoveBg, whiteBackground } from "./image.js";
import { generateProduct } from "./ai.js";
import type { Order, OrderStatus, Product, Shop } from "./db.js";
import { setOrderNotifier, setSellerNotifier, setStockNotifier } from "./server.js";

const PUBLIC_URL = (
  process.env.PUBLIC_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000")
).replace(/\/$/, "");
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function createBot(token: string) {
  const bot = new Bot(token);
  bot.use(async (ctx, next) => {
    const kind = Object.keys(ctx.update).find((k) => k !== "update_id");
    console.log(`update ${ctx.update.update_id} ${kind} from=${ctx.from?.id ?? "-"} chat=${ctx.chat?.id ?? "-"}`);
    return next();
  });
  const shopOf = (ctx: { from?: { id: number; first_name: string } }) =>
    getOrCreateShop(ctx.from!.id, ctx.from!.first_name);
  const BOT_USERNAME = process.env.BOT_USERNAME ?? "savia_shop_bot";
  const MINIAPP = process.env.MINIAPP_SHORTNAME; // short name from BotFather /newapp; opens the shop as a Telegram Mini App
  const link = (slug: string, productId?: number) =>
    MINIAPP
      ? `https://t.me/${BOT_USERNAME}/${MINIAPP}?startapp=${slug}${productId ? `__p${productId}` : ""}`
      : `${PUBLIC_URL}/s/${slug}${productId ? `#/p/${productId}` : ""}`;

  /** Owner and invited managers all get shop notifications. */
  const tellAdmins = (shop: Shop, text: string, extra?: Parameters<typeof bot.api.sendMessage>[2]) =>
    Promise.all(shopAdminIds(shop).map((id) => bot.api.sendMessage(id, text, extra).catch((e) => console.error("notify failed", id, e))));

  /** The button under a channel post links to the product page and turns into "Tugadi" when nothing is left. */
  async function setChannelButton(shop: Shop, p: Product) {
    if (!p.src_chat || !p.src_msg) return;
    try {
      await bot.api.editMessageReplyMarkup(p.src_chat, p.src_msg, {
        reply_markup: { inline_keyboard: [[{ text: isSoldOut(p) ? "❌ Tugadi" : "🛒 Buyurtma berish", url: link(shop.slug, p.id) }]] },
      });
      markButton(p.id, true);
    } catch (e) {
      console.error("channel button failed (the bot needs the 'Edit messages' admin right)", e);
    }
  }

  const stockText = (p: Product) =>
    p.stock ? Object.entries(p.stock).map(([k, q]) => `${k === "_" ? "jami" : k}: ${q}`).join(", ") : "kuzatilmaydi";

  const HELP = [
    "Mahsulot qo'shish: rasm yuboring, izohga narx va tavsifni yozing.",
    "Kanalingiz bo'lsa: /channel (postlar avtomatik katalogga o'tadi).",
    "",
    "Do'kon: /name, /about, /contact, /phones, /address, /banner",
    "Savdo: /products, /stock, /discount, /category, /promo, /delivery, /minorder, /payment",
    "Buyurtmalar: /orders",
    "Rassilka: /broadcast (xaridorlarga xabar), /buyers",
    "Jamoa: /invite (menejer qo'shish), /admins",
    "Do'kon linki: /shop",
  ].join("\n");

  bot.command("start", async (ctx) => {
    const payload = ctx.match.trim();
    if (payload.startsWith("inv_")) {
      const joined = acceptInvite(payload.slice(4), ctx.from!.id);
      return void ctx.reply(joined ? `Siz "${joined.name}" do'konining menejeri bo'ldingiz. Buyurtmalar va savollar sizga ham keladi.\n\n${HELP}` : "Taklif eskirgan yoki ishlatilgan.");
    }
    if (payload) {
      // A buyer opened a shop link: show the Mini App
      const target = getShopBySlug(payload.split("__")[0]);
      if (target) {
        upsertBuyer(target.id, ctx.from!.id, ctx.from!.first_name, true); // started the bot: we may message them
        const url = `${PUBLIC_URL}/s/${target.slug}`;
        const kb = url.startsWith("https://") ? new InlineKeyboard().webApp(`🛍 ${target.name}`, url) : new InlineKeyboard().url(`🛍 ${target.name}`, url);
        return void ctx.reply(`${target.name} do'koniga xush kelibsiz!`, { reply_markup: kb });
      }
    }
    const shop = shopOf(ctx);
    await ctx.reply(`Salom! Men Savia botman: Telegramda do'kon ochish va AI yordamchi.\n\nDo'koningiz: ${link(shop.slug)}\n\n${HELP}`);
  });

  bot.command("help", (ctx) => ctx.reply(HELP));

  bot.command("shop", (ctx) => ctx.reply(link(shopOf(ctx).slug)));

  bot.command("name", async (ctx) => {
    const name = ctx.match.trim().slice(0, 60);
    if (!name) return void ctx.reply("Masalan: /name Gulnora Moda");
    updateShop(shopOf(ctx).id, { name });
    await ctx.reply("Do'kon nomi yangilandi.");
  });

  bot.command("contact", async (ctx) => {
    const contact = ctx.match.trim().slice(0, 80);
    if (!contact) return void ctx.reply("Masalan: /contact @gulnora yoki /contact +998901234567");
    updateShop(shopOf(ctx).id, { contact });
    await ctx.reply("Aloqa ma'lumoti saqlandi.");
  });

  const num = (v: string | undefined) => (v && /^\d{1,9}$/.test(v) ? Number(v) : null);

  bot.command("about", async (ctx) => {
    const about = ctx.match.trim().slice(0, 300);
    if (!about) return void ctx.reply("Masalan: /about Erkaklar kiyimi, Toshkent. Har kuni 10:00–20:00");
    updateShop(shopOf(ctx).id, { about });
    await ctx.reply("Do'kon tavsifi saqlandi.");
  });

  bot.command("phones", async (ctx) => {
    const list = ctx.match.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
    if (!list.length) return void ctx.reply("Masalan: /phones +998901234567, +998931112233");
    updateShop(shopOf(ctx).id, { phones: JSON.stringify(list.map((x) => x.slice(0, 20))) });
    await ctx.reply("Telefonlar saqlandi.");
  });

  bot.command("address", async (ctx) => {
    const address = ctx.match.trim().slice(0, 200);
    if (!address) return void ctx.reply("Masalan: /address Toshkent, Chilonzor 5, 12-uy");
    updateShop(shopOf(ctx).id, { address });
    await ctx.reply("Manzil saqlandi.");
  });

  bot.command("minorder", async (ctx) => {
    const v = ctx.match.trim() === "off" ? 0 : num(ctx.match.trim());
    if (v == null) return void ctx.reply("Masalan: /minorder 100000 (o'chirish: /minorder off)");
    updateShop(shopOf(ctx).id, { min_order: v });
    await ctx.reply(v ? `Minimal buyurtma: ${v}` : "Minimal buyurtma o'chirildi.");
  });

  bot.command("delivery", async (ctx) => {
    const [a, b] = ctx.match.trim().split(/\s+/);
    const fee = a === "off" ? 0 : num(a);
    if (fee == null) return void ctx.reply("Masalan: /delivery 25000 (yetkazish narxi) yoki /delivery 25000 500000 (500 000 dan ortiq buyurtmada bepul). O'chirish: /delivery off");
    updateShop(shopOf(ctx).id, { delivery_fee: fee, free_from: num(b) ?? 0 });
    await ctx.reply(fee ? `Yetkazib berish: ${fee}${num(b) ? `, ${num(b)} dan bepul` : ""}` : "Yetkazib berish narxi o'chirildi.");
  });

  bot.command("banner", async (ctx) => {
    const shop = shopOf(ctx);
    if (ctx.match.trim() === "clear") {
      updateShop(shop.id, { banners: "[]" });
      return void ctx.reply("Bannerlar o'chirildi.");
    }
    await ctx.reply(`Banner qo'shish: rasm yuboring va izohga /banner yozing (${shopBanners(shop).length}/5). O'chirish: /banner clear`);
  });

  bot.command("promo", async (ctx) => {
    const shop = shopOf(ctx);
    const [a, b] = ctx.match.trim().split(/\s+/);
    if (!a) {
      const promos = listPromos(shop.id);
      return void ctx.reply(promos.length ? promos.map((p) => `${p.code} — ${p.percent}%${p.active ? "" : " (o'chirilgan)"}, ${p.uses} marta`).join("\n") + "\n\nYaratish: /promo YOZ10 10" : "Promokod yo'q. Yaratish: /promo YOZ10 10 (10% chegirma)");
    }
    if (a === "off" && b) return void ctx.reply(setPromoActive(shop.id, b, false) ? "Promokod o'chirildi." : "Topilmadi.");
    const percent = num(b);
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(a) || percent == null || percent < 1 || percent > 90) return void ctx.reply("Masalan: /promo YOZ10 10 (1–90%)");
    savePromo(shop.id, a, percent);
    await ctx.reply(`Promokod ${a.toUpperCase()}: ${percent}% chegirma.`);
  });

  bot.command("discount", async (ctx) => {
    const shop = shopOf(ctx);
    const [id, v] = ctx.match.trim().split(/\s+/);
    const percent = v === "off" ? null : num(v);
    if (!num(id) || (v !== "off" && (percent == null || percent < 1 || percent > 90))) return void ctx.reply("Masalan: /discount 12 20 (20% chegirma) yoki /discount 12 off");
    if (!setDiscount(Number(id), shop.id, percent)) return void ctx.reply("Mahsulot topilmadi yoki narxi yo'q.");
    await ctx.reply(percent == null ? "Chegirma olib tashlandi." : `Chegirma qo'yildi: -${percent}%`);
  });

  bot.command("category", async (ctx) => {
    const shop = shopOf(ctx);
    const m = /^(\d+)\s+(.{1,30})$/.exec(ctx.match.trim());
    if (!m) return void ctx.reply(`Masalan: /category 12 Kurtkalar\nMavjud: ${shopCategories(shop.id).join(", ") || "hali yo'q"}`);
    await ctx.reply(setCategory(Number(m[1]), shop.id, m[2]) ? "Kategoriya o'zgartirildi." : "Mahsulot topilmadi.");
  });

  bot.command("invite", async (ctx) => {
    const shop = shopOf(ctx);
    if (ctx.from!.id !== shop.tg_id) return void ctx.reply("Faqat do'kon egasi menejer qo'sha oladi.");
    await ctx.reply(`Menejerga shu linkni yuboring (bir marta ishlaydi):\nhttps://t.me/${BOT_USERNAME}?start=inv_${createInvite(shop.id)}`);
  });

  bot.command("admins", async (ctx) => {
    const shop = shopOf(ctx);
    const rm = /^remove\s+(\d+)$/.exec(ctx.match.trim());
    if (rm) {
      if (ctx.from!.id !== shop.tg_id) return void ctx.reply("Faqat do'kon egasi o'chira oladi.");
      return void ctx.reply(removeAdmin(shop.id, Number(rm[1])) ? "Menejer o'chirildi." : "Topilmadi.");
    }
    await ctx.reply(`Egasi: ${shop.tg_id}\nMenejerlar: ${shopAdminIds(shop).slice(1).join(", ") || "yo'q"}\n\nQo'shish: /invite, o'chirish: /admins remove <id>`);
  });

  // --- broadcasts: the seller previews and confirms, sending runs in the background ---
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const MAX_BROADCASTS_PER_DAY = 3;
  const pendingBroadcast = new Map<number, { shopId: number; text: string; photo?: string }>();

  async function previewBroadcast(ctx: any, text: string, photo?: string) {
    const shop = shopOf(ctx);
    const body = text.trim().slice(0, 900);
    if (!body && !photo) {
      return void ctx.reply("Masalan: /broadcast Yangi kolleksiya keldi! Barcha kurtkalarga -20%.\nRasm bilan: rasm yuboring va izohga /broadcast matn yozing.");
    }
    const targets = broadcastTargets(shop.id).length;
    if (!targets) {
      return void ctx.reply("Hozircha xabar yuborish mumkin bo'lgan xaridor yo'q. Xaridor do'konda buyurtma bergach yoki botni /start qilgach ro'yxatga tushadi (/buyers).");
    }
    if (broadcastsToday(shop.id) >= MAX_BROADCASTS_PER_DAY) return void ctx.reply(`Bir kunda eng ko'pi ${MAX_BROADCASTS_PER_DAY} ta rassilka mumkin. Ertaga urinib ko'ring.`);
    pendingBroadcast.set(ctx.from.id, { shopId: shop.id, text: body, photo });
    const kb = new InlineKeyboard().text(`✅ Yuborish (${targets} ta)`, "bc:send").text("Bekor qilish", "bc:cancel");
    const note = `\n\n— Xabar shunday ko'rinadi. ${targets} ta xaridorga yuboriladi.`;
    if (photo) await ctx.replyWithPhoto(photo, { caption: body + note, reply_markup: kb });
    else await ctx.reply(body + note, { reply_markup: kb });
  }

  async function runBroadcast(shop: Shop, b: { text: string; photo?: string }, adminId: number) {
    const kb = new InlineKeyboard().url("🛍 Do'konni ochish", link(shop.slug));
    let sent = 0;
    let failed = 0;
    for (const id of broadcastTargets(shop.id)) {
      try {
        if (b.photo) await bot.api.sendPhoto(id, b.photo, { caption: b.text, reply_markup: kb });
        else await bot.api.sendMessage(id, b.text, { reply_markup: kb });
        sent++;
      } catch (e: any) {
        failed++;
        if (e?.error_code === 403 || e?.error_code === 400) markBuyerBlocked(shop.id, id); // blocked the bot or never allowed messages
        else if (e?.error_code === 429) await sleep((e.parameters?.retry_after ?? 3) * 1000);
      }
      await sleep(60); // stay far below Telegram's ~30 messages/second limit
    }
    logBroadcast(shop.id, sent, failed);
    await bot.api.sendMessage(adminId, `Rassilka tugadi: ${sent} ta yuborildi, ${failed} ta yetib bormadi.`).catch(() => undefined);
  }

  bot.command("broadcast", (ctx) => previewBroadcast(ctx, ctx.match));

  bot.command("buyers", async (ctx) => {
    const c = buyerCounts(shopOf(ctx).id);
    await ctx.reply(`Xaridorlar: ${c.total}\nXabar yuborish mumkin: ${c.reachable ?? 0}\n\nRassilka: /broadcast matn`);
  });

  bot.callbackQuery("bc:cancel", async (ctx) => {
    pendingBroadcast.delete(ctx.from.id);
    await ctx.answerCallbackQuery("Bekor qilindi");
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }).catch(() => undefined);
  });

  bot.callbackQuery("bc:send", async (ctx) => {
    const p = pendingBroadcast.get(ctx.from.id);
    const shop = shopOf(ctx);
    if (!p || p.shopId !== shop.id) return void ctx.answerCallbackQuery({ text: "Eskirgan. Qaytadan /broadcast yozing.", show_alert: true });
    pendingBroadcast.delete(ctx.from.id);
    await ctx.answerCallbackQuery("Yuborilmoqda...");
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }).catch(() => undefined);
    void runBroadcast(shop, p, ctx.from.id); // not awaited: a long send must not block other updates
  });

  bot.command("channel", (ctx) =>
    ctx.reply(
      "Telegram kanalingizni ulash (postlar avtomatik katalogga o'tadi):\n\n1. Kanalingiz → Administratorlar → Administrator qo'shish → @savia_shop_bot\n2. Kanaldagi istalgan postni shu botga FORWARD qiling.\n\nBot kanalni ulaydi. Keyin kanalga qo'ygan har yangi rasmli post (razmer, narx, kod bilan) avtomatik mahsulot bo'ladi. Eski postlarni ham forward qilib qo'shishingiz mumkin.",
    ),
  );

  bot.command("payment", async (ctx) => {
    const payment = ctx.match.trim().slice(0, 200);
    if (!payment) return void ctx.reply("Masalan: /payment Karta 8600 1234 5678 9012 (Gulnora A.) yoki /payment Naqd pul, yetkazganda");
    updateShop(shopOf(ctx).id, { payment });
    await ctx.reply("To'lov ma'lumoti saqlandi. Xaridor buyurtma bergach shu ko'rinadi.");
  });

  bot.command("orders", async (ctx) => {
    const orders = listOrders(shopOf(ctx).id);
    if (!orders.length) return void ctx.reply("Hali buyurtma yo'q.");
    for (const o of orders) await ctx.reply(orderText(o), { reply_markup: orderKeyboard(o) });
  });

  bot.callbackQuery(/^ord:(confirmed|shipped|cancelled):(\d+)$/, async (ctx) => {
    const status = ctx.match[1] as OrderStatus;
    const shop = shopOf(ctx);
    if (!setOrderStatus(Number(ctx.match[2]), shop.id, status)) return void ctx.answerCallbackQuery("Topilmadi");
    await ctx.answerCallbackQuery(STATUS[status]);
    const o = getOrder(Number(ctx.match[2]))!;
    if (status === "cancelled") {
      for (const it of getOrderItems(o.id)) {
        const p = getProduct(it.product_id);
        if (p?.src_btn) await setChannelButton(shop, p);
      }
    }
    await ctx.editMessageText(orderText(o), { reply_markup: orderKeyboard(o) });
    if (o.buyer_tg_id) {
      const uz = { new: "yangi", confirmed: "tasdiqlandi", shipped: "yuborildi", cancelled: "bekor qilindi" }[status];
      const ru = { new: "новый", confirmed: "подтверждён", shipped: "отправлен", cancelled: "отменён" }[status];
      bot.api.sendMessage(o.buyer_tg_id, `Buyurtma #${o.id} ${uz} / Заказ #${o.id} ${ru}`).catch(() => undefined);
    }
  });

  bot.callbackQuery(/^stk:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`Qoldiqni kiriting:\n/stock ${ctx.match[1]} 46:3 48:5 50:2  (razmer bo'yicha)\n/stock ${ctx.match[1]} 10  (umumiy son)\n/stock ${ctx.match[1]} off  (kuzatmaslik)`);
  });

  bot.command("stock", async (ctx) => {
    const shop = shopOf(ctx);
    const args = ctx.match.trim().split(/\s+/).filter(Boolean);
    if (!args.length) {
      const items = listProducts(shop.id).slice(0, 30);
      if (!items.length) return void ctx.reply("Hali mahsulot yo'q.");
      return void ctx.reply(items.map((p) => `#${p.id} ${p.translations.uz.title} — ${stockText(p)}`).join("\n") + "\n\nO'zgartirish: /stock <raqam> 46:3 48:5");
    }
    const p = getProduct(Number(args[0]));
    if (!p || p.shop_id !== shop.id) return void ctx.reply("Mahsulot topilmadi. /products");
    const rest = args.slice(1);
    if (!rest.length) return void ctx.reply(`#${p.id} ${p.translations.uz.title}: ${stockText(p)}\n\nO'zgartirish: /stock ${p.id} 46:3 48:5 yoki /stock ${p.id} 10 yoki /stock ${p.id} off`);
    let stock: Record<string, number> | null;
    if (rest[0] === "off") stock = null;
    else if (rest.length === 1 && /^\d{1,6}$/.test(rest[0])) stock = { _: Number(rest[0]) };
    else {
      stock = {};
      for (const pair of rest) {
        const m = /^([^:=\s]{1,12})[:=](\d{1,6})$/.exec(pair);
        if (!m || m[1] === "_" || Object.keys(stock).length >= 30) return void ctx.reply(`Noto'g'ri format: "${pair}". Masalan: /stock ${p.id} 46:3 48:5`);
        stock[m[1]] = Number(m[2]);
      }
    }
    setStock(p.id, shop.id, stock);
    const fresh = getProduct(p.id)!;
    if (fresh.src_btn) await setChannelButton(shop, fresh);
    await ctx.reply(`Qoldiq yangilandi (#${p.id}): ${stockText(fresh)}`);
  });

  bot.command("products", async (ctx) => {
    const items = listProducts(shopOf(ctx).id);
    if (!items.length) return void ctx.reply("Hali mahsulot yo'q. Rasm yuboring.");
    for (const p of items.slice(0, 20)) {
      await ctx.reply(`#${p.id} ${p.translations.uz.title} — ${p.price ?? "?"} ${p.currency}`, {
        reply_markup: new InlineKeyboard().text("O'chirish", `del:${p.id}`),
      });
    }
  });

  bot.callbackQuery(/^del:(\d+)$/, async (ctx) => {
    const ok = deleteProduct(Number(ctx.match[1]), shopOf(ctx).id);
    await ctx.answerCallbackQuery(ok ? "O'chirildi" : "Topilmadi");
    if (ok) await ctx.editMessageText("O'chirildi.");
  });

  type Img = { id: string; mime: string; srcMsg?: number };
  const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const MAX_IMAGES = 6;
  const MAX_AI_IMAGES = 4;

  const productKeyboard = (id: number, hasPhotos: boolean) => {
    const kb = new InlineKeyboard();
    if (hasPhotos && hasRemoveBg) kb.text("Oq fon", `bg:${id}`);
    return kb.text("Qoldiq", `stk:${id}`).text("O'chirish", `del:${id}`);
  };

  bot.callbackQuery(/^bg:(\d+)$/, async (ctx) => {
    const shop = shopOf(ctx);
    const p = getProduct(Number(ctx.match[1]));
    if (!p || p.shop_id !== shop.id) return void ctx.answerCallbackQuery("Topilmadi");
    if (!hasRemoveBg) return void ctx.answerCallbackQuery({ text: "Oq fon hali sozlanmagan", show_alert: true });
    await ctx.answerCallbackQuery("Ishlayapti, biroz kuting...");
    let failed = 0;
    const out: string[] = [];
    for (const f of p.photos) {
      try {
        out.push(await whiteBackground(f));
      } catch (e) {
        failed++;
        console.error("white background failed", e);
        out.push(f);
      }
    }
    updateProductPhotos(p.id, shop.id, out);
    await ctx.reply(failed ? `Oq fon: ${out.length - failed}/${out.length} rasm tayyor.` : `Oq fon tayyor (#${p.id}). Katalog: ${link(shop.slug)}`);
  });

  /** Downloads the photos, runs the AI and stores the product. Shared by DM uploads and channel posts. */
  async function buildProduct(api: Api, shop: Shop, text: string, files: Img[], src?: { chat: number; msg: number }) {
    const photos: string[] = [];
    const images: NonNullable<Parameters<typeof generateProduct>[0]["images"]> = [];
    for (const f of files.slice(0, MAX_IMAGES)) {
      const file = await api.getFile(f.id);
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_PHOTO_BYTES) continue;
      const mediaType = (MEDIA as readonly string[]).includes(f.mime) ? (f.mime as (typeof MEDIA)[number]) : "image/jpeg";
      const id = randomUUID();
      const name = `${id}.jpg`;
      writeFileSync(`${DATA_DIR}/photos/${id}.orig`, buf);
      writeFileSync(`${DATA_DIR}/photos/${name}`, await enhance(buf).catch(() => buf));
      photos.push(name);
      if (images.length < MAX_AI_IMAGES) images.push({ base64: buf.toString("base64"), mediaType });
    }
    const g = await generateProduct({ text, images, categories: shopCategories(shop.id) });
    return addProduct(
      { shop_id: shop.id, category: g.category, price: g.price, currency: g.currency || "UZS", attributes: g.attributes ?? {}, translations: g.translations, photos },
      src,
    );
  }

  async function createFromMessage(ctx: any, text: string, files: Img[]) {
    const shop = shopOf(ctx);
    const origin = ctx.message?.forward_origin;
    const srcMsg = files.map((f) => f.srcMsg).filter((m): m is number => m != null);
    const src = origin?.type === "channel" && shop.channel_id === origin.chat.id && srcMsg.length ? { chat: origin.chat.id as number, msg: Math.min(...srcMsg) } : undefined;
    if (src && productBySource(src.chat, src.msg)) return void ctx.reply("Bu post allaqachon katalogda bor.");
    await ctx.replyWithChatAction("typing");
    try {
      const p = await buildProduct(ctx.api, shop, text, files, src);
      if (src && files.length === 1) await setChannelButton(shop, p);
      const uz = p.translations.uz;
      await ctx.reply(
        `Qo'shildi (#${p.id}, ${p.photos.length} ta rasm):\n\n${uz.title}\n${uz.description}\nNarxi: ${p.price ?? "ko'rsatilmagan"} ${p.currency}\n\nKatalog: ${link(shop.slug)}`,
        { reply_markup: productKeyboard(p.id, p.photos.length > 0) },
      );
    } catch (e) {
      console.error("product generation failed", e);
      await ctx.reply("AI xatolik berdi, qayta urinib ko'ring.");
    }
  }

  // Telegram sends an album as separate messages sharing media_group_id; merge them into one product.
  const albums = new Map<string, { files: Img[]; caption: string; timer?: NodeJS.Timeout }>();
  function collect(key: string | undefined, caption: string, file: Img, done: (text: string, files: Img[]) => void) {
    if (!key) return done(caption, [file]);
    let g = albums.get(key);
    if (!g) albums.set(key, (g = { files: [], caption: "" }));
    g.files.push(file);
    if (caption) g.caption = caption;
    clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      albums.delete(key);
      done(g!.caption, g!.files);
    }, 1500);
  }

  const originMsg = (m: any): number | undefined => (m.forward_origin?.type === "channel" ? m.forward_origin.message_id : undefined);

  // Linking a channel: the sender forwards any post from it, and must be an admin of that channel.
  bot.on("message:forward_origin", async (ctx, next) => {
    const o = ctx.message.forward_origin;
    if (o.type !== "channel") return next();
    const shop = shopOf(ctx);
    if (shop.channel_id !== o.chat.id) {
      const other = getShopByChannel(o.chat.id);
      if (other && other.id !== shop.id) return void ctx.reply("Bu kanal boshqa do'konga ulangan.");
      let ok = false;
      try {
        const m = await ctx.api.getChatMember(o.chat.id, ctx.from.id);
        ok = m.status === "creator" || m.status === "administrator";
      } catch {
        /* bot is not in the channel */
      }
      if (!ok) {
        return void ctx.reply("Kanalni ulash uchun avval botni kanalga ADMINISTRATOR qilib qo'shing (siz ham kanal admini bo'lishingiz kerak), so'ng postni qayta forward qiling. Yo'riqnoma: /channel");
      }
      setShopChannel(shop.id, o.chat.id);
      await ctx.reply(`Kanal ulandi: ${o.chat.title}\nEndi kanalga qo'yiladigan yangi postlar avtomatik katalogga qo'shiladi.\nEski postlarni shu yerga forward qilsangiz ham qo'shiladi.`);
    }
    return next();
  });

  bot.on("message:photo", async (ctx) => {
    const sizes = ctx.message.photo;
    if (/^\/broadcast\b/i.test(ctx.message.caption ?? "")) {
      return previewBroadcast(ctx, (ctx.message.caption ?? "").replace(/^\/broadcast\s*/i, ""), sizes[sizes.length - 1].file_id);
    }
    if (/^\/banner\b/i.test(ctx.message.caption ?? "")) {
      const shop = shopOf(ctx);
      const have = shopBanners(shop);
      if (have.length >= 5) return void ctx.reply("Eng ko'pi 5 ta banner. /banner clear bilan tozalang.");
      const file = await ctx.api.getFile(sizes[sizes.length - 1].file_id);
      const buf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`)).arrayBuffer());
      const name = `${randomUUID()}.jpg`;
      writeFileSync(`${DATA_DIR}/photos/${name}`, await enhance(buf).catch(() => buf));
      updateShop(shop.id, { banners: JSON.stringify([...have, name]) });
      return void ctx.reply(`Banner qo'shildi (${have.length + 1}/5).`);
    }
    const file = { id: sizes[sizes.length - 1].file_id, mime: "image/jpeg", srcMsg: originMsg(ctx.message) };
    return collect(ctx.message.media_group_id, ctx.message.caption ?? "", file, (t, f) => void createFromMessage(ctx, t, f));
  });

  bot.on("message:document", (ctx) => {
    const d = ctx.message.document;
    if (!d.mime_type?.startsWith("image/")) return ctx.reply("Faqat rasm yuboring (jpg, png, webp).");
    const file = { id: d.file_id, mime: d.mime_type, srcMsg: originMsg(ctx.message) };
    return collect(ctx.message.media_group_id, ctx.message.caption ?? "", file, (t, f) => void createFromMessage(ctx, t, f));
  });

  // New posts in a linked channel become products automatically (the bot must be a channel admin).
  bot.on("channel_post", (ctx) => {
    const shop = getShopByChannel(ctx.chat.id);
    const m = ctx.channelPost;
    if (!shop) return;
    const photo = m.photo?.[m.photo.length - 1];
    const doc = m.document?.mime_type?.startsWith("image/") ? m.document : undefined;
    const fileId = photo?.file_id ?? doc?.file_id;
    if (!fileId) return;
    const file = { id: fileId, mime: photo ? "image/jpeg" : doc!.mime_type!, srcMsg: m.message_id };
    const chat = ctx.chat.id;
    collect(m.media_group_id ? `${chat}:${m.media_group_id}` : undefined, m.caption ?? "", file, (text, files) => {
      const msg = Math.min(...files.map((f) => f.srcMsg!));
      if (productBySource(chat, msg)) return;
      buildProduct(ctx.api, shop, text, files, { chat, msg })
        .then(async (p) => {
          if (files.length === 1) await setChannelButton(shop, p);
          return tellAdmins(shop, `Kanaldan yangi mahsulot qo'shildi (#${p.id}): ${p.translations.uz.title}\nKatalog: ${link(shop.slug)}`, {
            reply_markup: productKeyboard(p.id, p.photos.length > 0),
          });
        })
        .catch((e) => console.error("channel import failed", e));
    });
  });

  bot.on("message:text", (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    return ctx.reply(
      "Mahsulot qo'shish uchun rasm yuboring va narx/tavsifni rasm izohiga (caption) yozing.\nMasalan: rasm + \"erkaklar kurtkasi, 500 000 so'm\".\nKanalingiz bo'lsa: /channel\nMahsulotlar: /products",
    );
  });

  bot.on("message:voice", (ctx) =>
    ctx.reply("Ovozli xabar keyingi versiyada. Hozircha matn yoki rasm+izoh yuboring."),
  );

  const STATUS: Record<OrderStatus, string> = { new: "Yangi", confirmed: "Tasdiqlandi", shipped: "Yuborildi", cancelled: "Bekor qilindi" };
  const orderText = (o: Order) => {
    const lines = getOrderItems(o.id).map(
      (i) => `• ${i.title}${i.size ? ` (${i.size})` : ""} x${i.qty}${i.price != null ? ` — ${new Intl.NumberFormat("ru-RU").format(i.price * i.qty)} ${i.currency}` : ""}`,
    );
    const head = [`Buyurtma #${o.id} — ${STATUS[o.status]}`, `Ism: ${o.name}`, `Telefon: ${o.phone}`];
    if (o.address) head.push(`Manzil: ${o.address}`);
    if (o.note) head.push(`Izoh: ${o.note}`);
    return [...head, "", ...lines, ...(o.total ? ["", `Jami: ${o.total}`] : [])].join("\n");
  };
  const orderKeyboard = (o: Order) =>
    new InlineKeyboard()
      .text("Tasdiqlash", `ord:confirmed:${o.id}`)
      .text("Yuborildi", `ord:shipped:${o.id}`)
      .row()
      .text("Bekor qilish", `ord:cancelled:${o.id}`);

  setOrderNotifier((shop, order) => {
    void tellAdmins(shop, orderText(order), { reply_markup: orderKeyboard(order) });
    if (order.buyer_tg_id) {
      bot.api
        .sendMessage(order.buyer_tg_id, `✅ Buyurtmangiz qabul qilindi / Заказ принят: #${order.id} (${shop.name}). ${order.total}`)
        .catch(() => undefined); // the buyer may not have started the bot
    }
  });

  setStockNotifier(async (shop, ids) => {
    for (const id of ids) {
      const p = getProduct(id);
      if (!p?.stock) continue;
      if (p.src_btn) await setChannelButton(shop, p);
      const low = Object.entries(p.stock).filter(([, q]) => q <= 2).map(([k, q]) => `${k === "_" ? "jami" : k}: ${q === 0 ? "tugadi" : `${q} ta qoldi`}`);
      if (low.length) {
        await tellAdmins(shop, `Qoldiq kam — ${p.translations.uz.title} (#${p.id}):\n${low.join("\n")}\n\nYangilash: /stock ${p.id} ...`);
      }
    }
  });

  setSellerNotifier((shop, product, question) => {
    void tellAdmins(shop, `Xaridor savoli (${product.translations.uz.title}, #${product.id}):\n"${question}"\n\nAI javob bera olmadi, o'zingiz bog'laning.`);
  });

  bot.catch((e) => console.error("bot error", e.error));
  return bot;
}
