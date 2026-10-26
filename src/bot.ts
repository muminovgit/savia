import { Bot, InlineKeyboard } from "grammy";
import type { Api } from "grammy";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DATA_DIR, isSoldOut, markButton, setStock, addProduct, deleteProduct, getOrCreateShop, getOrder, getOrderItems, getProduct, getShopByChannel, listOrders, productBySource, setShopChannel, listProducts, setOrderStatus, updateProductPhotos, updateShop } from "./db.js";
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
  const link = (slug: string) => `${PUBLIC_URL}/s/${slug}`;

  /** The button under a channel post links to the product page and turns into "Tugadi" when nothing is left. */
  async function setChannelButton(shop: Shop, p: Product) {
    if (!p.src_chat || !p.src_msg) return;
    try {
      await bot.api.editMessageReplyMarkup(p.src_chat, p.src_msg, {
        reply_markup: { inline_keyboard: [[{ text: isSoldOut(p) ? "❌ Tugadi" : "🛒 Buyurtma berish", url: `${link(shop.slug)}/p/${p.id}` }]] },
      });
      markButton(p.id, true);
    } catch (e) {
      console.error("channel button failed (the bot needs the 'Edit messages' admin right)", e);
    }
  }

  const stockText = (p: Product) =>
    p.stock ? Object.entries(p.stock).map(([k, q]) => `${k === "_" ? "jami" : k}: ${q}`).join(", ") : "kuzatilmaydi";

  bot.command("start", async (ctx) => {
    const shop = shopOf(ctx);
    await ctx.reply(
      `Salom! Men Savia botman.\n\nMahsulot qo'shish: rasm yuboring va izohga yozing, masalan:\n"qizil ko'ylak, 42-razmer, 180000 so'm"\n\nAI tavsif yozadi va o'zbek/rus/ingliz tillariga tarjima qiladi.\n\nDo'koningiz: ${link(shop.slug)}\n\nBuyruqlar:\n/products — mahsulotlar\n/name Do'kon nomi\n/contact @username yoki +998...\n/channel — kanalni ulash\n/stock — qoldiq\n/payment To'lov ma'lumoti (karta raqami va h.k.)\n/orders — buyurtmalar\n/shop — do'kon linki`,
    );
  });

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
    const g = await generateProduct({ text, images });
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

  bot.on("message:photo", (ctx) => {
    const sizes = ctx.message.photo;
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
          return bot.api.sendMessage(shop.tg_id, `Kanaldan yangi mahsulot qo'shildi (#${p.id}): ${p.translations.uz.title}\nKatalog: ${link(shop.slug)}`, {
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
    bot.api
      .sendMessage(shop.tg_id, orderText(order), { reply_markup: orderKeyboard(order) })
      .catch((e) => console.error("order notify failed", e));
  });

  setStockNotifier(async (shop, ids) => {
    for (const id of ids) {
      const p = getProduct(id);
      if (!p?.stock) continue;
      if (p.src_btn) await setChannelButton(shop, p);
      const low = Object.entries(p.stock).filter(([, q]) => q <= 2).map(([k, q]) => `${k === "_" ? "jami" : k}: ${q === 0 ? "tugadi" : `${q} ta qoldi`}`);
      if (low.length) {
        await bot.api
          .sendMessage(shop.tg_id, `Qoldiq kam — ${p.translations.uz.title} (#${p.id}):\n${low.join("\n")}\n\nYangilash: /stock ${p.id} ...`)
          .catch((e) => console.error("stock alert failed", e));
      }
    }
  });

  setSellerNotifier((shop, product, question) => {
    bot.api
      .sendMessage(shop.tg_id, `Xaridor savoli (${product.translations.uz.title}, #${product.id}):\n"${question}"\n\nAI javob bera olmadi, o'zingiz bog'laning.`)
      .catch((e) => console.error("notify failed", e));
  });

  bot.catch((e) => console.error("bot error", e.error));
  return bot;
}
