import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DATA_DIR, addProduct, db, getShopBySlug, listProducts, savePromo, setDiscount, setStock, updateShop } from "./db.js";

const ASSETS = fileURLToPath(new URL("../demo-assets/", import.meta.url));

const tr = (uz: string, ru: string, en: string, duz: string, dru: string, den: string) => ({
  uz: { title: uz, description: duz },
  ru: { title: ru, description: dru },
  en: { title: en, description: den },
});

/** A public sample shop (slug "demo") for showing Savia to sellers. It has no owner, so it can only be viewed and ordered from. */
export function seedDemo() {
  let shop = getShopBySlug("demo");
  if (!shop) {
    db.prepare("INSERT INTO shops (tg_id, slug, name) VALUES (-1, 'demo', 'Demo')").run();
    shop = getShopBySlug("demo")!;
  }
  updateShop(shop.id, {
    name: "Demo · Erkaklar kiyimi",
    about: "Savia demo do'koni: shu yerda xaridorga do'kon qanday ko'rinishini sinab ko'rasiz. Buyurtmalar haqiqiy emas.",
    contact: "@savia_shop_bot",
    payment: "Demo do'kon: to'lov talab qilinmaydi.",
    delivery_fee: 25000,
    free_from: 1000000,
    banners: JSON.stringify(["demo-vest.jpg", "demo-cardigan-blue.jpg"]),
  });
  if (listProducts(shop.id).length) return;

  for (const f of ["cardigan-grey", "cardigan-blue", "vest", "pants"]) copyFileSync(`${ASSETS}${f}.jpg`, `${DATA_DIR}/photos/demo-${f}.jpg`);
  const add = (title: ReturnType<typeof tr>, category: string, price: number, photo: string, attributes: Record<string, string>) =>
    addProduct({ shop_id: shop!.id, category, price, currency: "UZS", attributes, translations: title, photos: [`demo-${photo}.jpg`] });

  const grey = add(
    tr("Zamokli trikotaj kardigan", "Вязаный кардиган на молнии", "Zip-up knit cardigan",
       "Yumshoq paxtali trikotaj, ikki yo'nalishli zamok va tik yoqa. Kundalik va ish kiyimi uchun.",
       "Мягкий хлопковый трикотаж, двусторонняя молния и воротник-стойка. На каждый день.",
       "Soft cotton knit with a two-way zip and stand collar. Everyday wear."),
    "Kardiganlar", 540000, "cardigan-grey", { code: "KR-101", color: "kulrang", material: "paxta", size: "46-54" });
  add(
    tr("Zamokli kofta (rang tanlovi)", "Кофта на молнии (выбор цвета)", "Zip knit jacket (colour choice)",
       "Qizil, jigarrang, ko'k va to'q ko'k ranglarda mavjud. Zich trikotaj, issiq.",
       "Есть в бордовом, коричневом, синем и тёмно-синем цветах. Плотный тёплый трикотаж.",
       "Available in burgundy, brown, blue and navy. Dense, warm knit."),
    "Kardiganlar", 560000, "cardigan-blue", { code: "KR-102", color: "bordo, jigarrang, ko'k" });
  const vest = add(
    tr("Pux jilet", "Пуховый жилет", "Down vest",
       "Yengil va issiq pux jilet, ikki tomonlama zamok, yon cho'ntaklar.",
       "Лёгкий и тёплый пуховый жилет, двусторонняя молния, боковые карманы.",
       "Light, warm down vest with a two-way zip and side pockets."),
    "Jiletlar", 1450000, "vest", { code: "JL-210", color: "kulrang" });
  const pants = add(
    tr("Klassik shim", "Классические брюки", "Classic trousers",
       "Rezinkali bel, qulay kesim. Ofis va kundalik kiyish uchun.",
       "Эластичный пояс, удобный крой. Для офиса и на каждый день.",
       "Elastic waist, comfortable cut. For the office and everyday wear."),
    "Shimlar", 620000, "pants", { code: "SH-118", color: "to'q ko'k", size: "46-54" });

  setStock(grey.id, shop.id, { "46": 30, "48": 30, "50": 30, "52": 30 });
  setStock(vest.id, shop.id, { "46": 30, "48": 30, "50": 30, "52": 30 });
  setStock(pants.id, shop.id, { _: 100 });
  setDiscount(vest.id, shop.id, 15);
  savePromo(shop.id, "DEMO10", 10);
}
