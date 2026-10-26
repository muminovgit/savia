import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

export type Lang = "uz" | "ru" | "en";
export const LANGS: Lang[] = ["uz", "ru", "en"];

export interface Translation {
  title: string;
  description: string;
}

export interface Shop {
  id: number;
  tg_id: number;
  slug: string;
  name: string;
  contact: string;
  payment: string;
  channel_id: number | null;
  about: string;
  phones: string; // JSON array
  address: string;
  min_order: number;
  delivery_fee: number;
  free_from: number;
  banners: string; // JSON array of photo file names
}

export interface Product {
  id: number;
  shop_id: number;
  category: string;
  price: number | null;
  currency: string;
  attributes: Record<string, string>;
  translations: Record<Lang, Translation>;
  photos: string[];
  stock: Record<string, number> | null;
  old_price: number | null;
  src_chat: number | null;
  src_msg: number | null;
  src_btn: number;
}

export const DATA_DIR = process.env.DATA_DIR ?? "data";
mkdirSync(`${DATA_DIR}/photos`, { recursive: true });

export const db = new Database(`${DATA_DIR}/savia.db`);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY,
  tg_id INTEGER UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  category TEXT NOT NULL DEFAULT '',
  price REAL,
  currency TEXT NOT NULL DEFAULT 'UZS',
  attributes TEXT NOT NULL DEFAULT '{}',
  translations TEXT NOT NULL,
  photo TEXT
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  answered INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const parsePhotos = (v: string | null): string[] =>
  !v ? [] : v.startsWith("[") ? JSON.parse(v) : [v];

const toProduct = (r: any): Product => ({
  ...r,
  attributes: JSON.parse(r.attributes),
  translations: JSON.parse(r.translations),
  photos: parsePhotos(r.photo),
  stock: r.stock ? JSON.parse(r.stock) : null,
});

export function getOrCreateShop(tgId: number, displayName: string): Shop {
  const found = (db.prepare("SELECT * FROM shops WHERE tg_id = ?").get(tgId) ??
    db.prepare("SELECT s.* FROM shops s JOIN shop_admins a ON a.shop_id = s.id WHERE a.tg_id = ?").get(tgId)) as Shop | undefined;
  if (found) return found;
  const base = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `shop-${Math.random().toString(36).slice(2, 7)}`;
  let slug = base;
  for (let i = 2; db.prepare("SELECT 1 FROM shops WHERE slug = ?").get(slug); i++) slug = `${base}-${i}`;
  const id = db
    .prepare("INSERT INTO shops (tg_id, slug, name) VALUES (?, ?, ?)")
    .run(tgId, slug, displayName).lastInsertRowid;
  return db.prepare("SELECT * FROM shops WHERE id = ?").get(id) as Shop;
}

export const getShopBySlug = (slug: string) =>
  db.prepare("SELECT * FROM shops WHERE slug = ?").get(slug) as Shop | undefined;

export const getShopById = (id: number) =>
  db.prepare("SELECT * FROM shops WHERE id = ?").get(id) as Shop | undefined;

const SHOP_FIELDS = ["name", "contact", "payment", "about", "address", "phones", "min_order", "delivery_fee", "free_from", "banners"] as const;
type ShopField = (typeof SHOP_FIELDS)[number];

export function updateShop(id: number, fields: Partial<Pick<Shop, ShopField>>) {
  for (const k of SHOP_FIELDS) {
    if (fields[k] !== undefined) db.prepare(`UPDATE shops SET ${k} = ? WHERE id = ?`).run(fields[k]!, id);
  }
}

export const shopPhones = (s: Shop): string[] => JSON.parse(s.phones || "[]");
export const shopBanners = (s: Shop): string[] => JSON.parse(s.banners || "[]");

export function addProduct(p: Omit<Product, "id" | "stock" | "old_price" | "src_chat" | "src_msg" | "src_btn">, src?: { chat: number; msg: number }): Product {
  const id = db
    .prepare(
      "INSERT INTO products (shop_id, category, price, currency, attributes, translations, photo, src_chat, src_msg) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .run(p.shop_id, p.category, p.price, p.currency, JSON.stringify(p.attributes), JSON.stringify(p.translations), p.photos.length ? JSON.stringify(p.photos) : null, src?.chat ?? null, src?.msg ?? null)
    .lastInsertRowid;
  return getProduct(Number(id))!;
}

export const getProduct = (id: number) => {
  const r = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return r ? toProduct(r) : undefined;
};

export const listProducts = (shopId: number) =>
  db.prepare("SELECT * FROM products WHERE shop_id = ? ORDER BY id DESC").all(shopId).map(toProduct);

export function updateProductPhotos(id: number, shopId: number, photos: string[]) {
  db.prepare("UPDATE products SET photo = ? WHERE id = ? AND shop_id = ?").run(
    photos.length ? JSON.stringify(photos) : null,
    id,
    shopId,
  );
}

export function deleteProduct(id: number, shopId: number): boolean {
  return db.prepare("DELETE FROM products WHERE id = ? AND shop_id = ?").run(id, shopId).changes > 0;
}

export function logQuestion(productId: number, question: string, answered: boolean) {
  db.prepare("INSERT INTO questions (product_id, question, answered) VALUES (?,?,?)").run(
    productId,
    question,
    answered ? 1 : 0,
  );
}

// --- orders ---
try {
  db.exec("ALTER TABLE shops ADD COLUMN payment TEXT NOT NULL DEFAULT ''");
} catch {
  /* column already exists */
}
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  total TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  price REAL,
  currency TEXT NOT NULL,
  qty INTEGER NOT NULL
);
`);

export type OrderStatus = "new" | "confirmed" | "shipped" | "cancelled";

export interface Order {
  id: number;
  shop_id: number;
  name: string;
  phone: string;
  address: string;
  note: string;
  total: string;
  discount: string;
  delivery: string;
  buyer_tg_id: number | null;
  status: OrderStatus;
  created_at: string;
}

export interface OrderItem {
  product_id: number;
  title: string;
  price: number | null;
  currency: string;
  qty: number;
  size: string;
}

export class OutOfStock extends Error {
  constructor(public title: string, public size: string, public have: number) {
    super(`out of stock: ${title} ${size}`);
  }
}

export const sizesOf = (p: Product) => (p.stock ? Object.keys(p.stock).filter((k) => k !== "_") : []);
export const isSoldOut = (p: Product) => p.stock != null && Object.values(p.stock).every((q) => q <= 0);

export function setStock(id: number, shopId: number, stock: Record<string, number> | null): boolean {
  return db.prepare("UPDATE products SET stock = ? WHERE id = ? AND shop_id = ?").run(stock ? JSON.stringify(stock) : null, id, shopId).changes > 0;
}

export const markButton = (id: number, on: boolean) => void db.prepare("UPDATE products SET src_btn = ? WHERE id = ?").run(on ? 1 : 0, id);

export interface Quote {
  currency: string | null; // null when items mix currencies or have no price: no discount/delivery logic then
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  text: string;
}

const fmtMoney = (v: number, c: string) => `${new Intl.NumberFormat("ru-RU").format(v)} ${c}`;

/** Prices an order. Promo percent and delivery only apply when everything is priced in one currency. */
export function quote(shop: Shop, items: { product: Product; qty: number }[], percent = 0): Quote {
  const sums = new Map<string, number>();
  let unpriced = false;
  for (const { product, qty } of items) {
    if (product.price == null) unpriced = true;
    else sums.set(product.currency, (sums.get(product.currency) ?? 0) + product.price * qty);
  }
  if (sums.size !== 1 || unpriced) {
    const text = [...sums].map(([c, v]) => fmtMoney(v, c)).join(" + ");
    return { currency: null, subtotal: 0, discount: 0, delivery: 0, total: 0, text };
  }
  const [[currency, subtotal]] = [...sums];
  const discount = Math.round((subtotal * percent) / 100);
  const after = subtotal - discount;
  const delivery = shop.delivery_fee > 0 && !(shop.free_from > 0 && after >= shop.free_from) ? shop.delivery_fee : 0;
  const total = after + delivery;
  return { currency, subtotal, discount, delivery, total, text: fmtMoney(total, currency) };
}

export function createOrder(
  shopId: number,
  customer: { name: string; phone: string; address: string; note: string; buyer_tg_id?: number | null },
  items: { product: Product; qty: number; size?: string }[],
  q: Quote,
  promoCode?: string,
): Order {
  const tx = db.transaction(() => {
    const id = Number(
      db
        .prepare("INSERT INTO orders (shop_id, name, phone, address, note, total, discount, delivery, buyer_tg_id) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(
          shopId,
          customer.name,
          customer.phone,
          customer.address,
          customer.note,
          q.text,
          q.discount && q.currency ? `${promoCode ?? ""} -${fmtMoney(q.discount, q.currency)}`.trim() : "",
          q.delivery && q.currency ? fmtMoney(q.delivery, q.currency) : "",
          customer.buyer_tg_id ?? null,
        ).lastInsertRowid,
    );
    const ins = db.prepare("INSERT INTO order_items (order_id, product_id, title, price, currency, qty, size) VALUES (?,?,?,?,?,?,?)");
    for (const { product, qty, size = "" } of items) {
      const fresh = getProduct(product.id)!; // re-read inside the transaction: two buyers must not take the last item
      if (fresh.stock) {
        const key = sizesOf(fresh).length ? size : "_";
        const have = fresh.stock[key] ?? 0;
        if (qty > have) throw new OutOfStock(product.translations.uz.title, size, have);
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(JSON.stringify({ ...fresh.stock, [key]: have - qty }), product.id);
      }
      ins.run(id, product.id, product.translations.uz.title, product.price, product.currency, qty, size);
    }
    return id;
  });
  return getOrder(tx())!;
}

export const getOrder = (id: number) => db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;

export const getOrderItems = (orderId: number) =>
  db.prepare("SELECT product_id, title, price, currency, qty, size FROM order_items WHERE order_id = ?").all(orderId) as OrderItem[];

export const listOrders = (shopId: number, limit = 10) =>
  db.prepare("SELECT * FROM orders WHERE shop_id = ? ORDER BY id DESC LIMIT ?").all(shopId, limit) as Order[];

export function setOrderStatus(id: number, shopId: number, status: OrderStatus): boolean {
  const old = getOrder(id);
  if (!old || old.shop_id !== shopId) return false;
  db.transaction(() => {
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
    if (status === "cancelled" && old.status !== "cancelled") {
      for (const it of getOrderItems(id)) {
        const p = getProduct(it.product_id);
        if (!p?.stock) continue;
        const key = sizesOf(p).length ? it.size : "_";
        db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(JSON.stringify({ ...p.stock, [key]: (p.stock[key] ?? 0) + it.qty }), p.id);
      }
    }
  })();
  return true;
}

// --- channel import ---
for (const ddl of [
  "ALTER TABLE shops ADD COLUMN channel_id INTEGER",
  "ALTER TABLE products ADD COLUMN src_chat INTEGER",
  "ALTER TABLE products ADD COLUMN src_msg INTEGER",
]) {
  try {
    db.exec(ddl);
  } catch {
    /* column already exists */
  }
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS products_src ON products(src_chat, src_msg) WHERE src_chat IS NOT NULL");

export const getShopByChannel = (channelId: number) =>
  db.prepare("SELECT * FROM shops WHERE channel_id = ?").get(channelId) as Shop | undefined;

export const setShopChannel = (shopId: number, channelId: number | null) =>
  void db.prepare("UPDATE shops SET channel_id = ? WHERE id = ?").run(channelId, shopId);

export const productBySource = (chat: number, msg: number) =>
  db.prepare("SELECT id FROM products WHERE src_chat = ? AND src_msg = ?").get(chat, msg) as { id: number } | undefined;

// --- stock ---
for (const ddl of [
  "ALTER TABLE products ADD COLUMN stock TEXT",
  "ALTER TABLE products ADD COLUMN src_btn INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE order_items ADD COLUMN size TEXT NOT NULL DEFAULT ''",
]) {
  try {
    db.exec(ddl);
  } catch {
    /* column already exists */
  }
}

// --- storefront settings, discounts, promos, admins ---
for (const ddl of [
  "ALTER TABLE shops ADD COLUMN about TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE shops ADD COLUMN phones TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE shops ADD COLUMN address TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE shops ADD COLUMN min_order REAL NOT NULL DEFAULT 0",
  "ALTER TABLE shops ADD COLUMN delivery_fee REAL NOT NULL DEFAULT 0",
  "ALTER TABLE shops ADD COLUMN free_from REAL NOT NULL DEFAULT 0",
  "ALTER TABLE shops ADD COLUMN banners TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE products ADD COLUMN old_price REAL",
  "ALTER TABLE orders ADD COLUMN discount TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE orders ADD COLUMN delivery TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE orders ADD COLUMN buyer_tg_id INTEGER",
]) {
  try {
    db.exec(ddl);
  } catch {
    /* column already exists */
  }
}
db.exec(`
CREATE TABLE IF NOT EXISTS promos (
  id INTEGER PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  code TEXT NOT NULL,
  percent INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  UNIQUE (shop_id, code)
);
CREATE TABLE IF NOT EXISTS shop_admins (
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  tg_id INTEGER NOT NULL,
  PRIMARY KEY (shop_id, tg_id)
);
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id)
);
`);

export interface Promo {
  id: number;
  shop_id: number;
  code: string;
  percent: number;
  active: number;
  uses: number;
}

const normCode = (c: string) => c.trim().toUpperCase().slice(0, 20);

export const getPromo = (shopId: number, code: string) =>
  db.prepare("SELECT * FROM promos WHERE shop_id = ? AND code = ? AND active = 1").get(shopId, normCode(code)) as Promo | undefined;

export const listPromos = (shopId: number) => db.prepare("SELECT * FROM promos WHERE shop_id = ? ORDER BY id DESC").all(shopId) as Promo[];

export function savePromo(shopId: number, code: string, percent: number) {
  db.prepare(
    "INSERT INTO promos (shop_id, code, percent) VALUES (?,?,?) ON CONFLICT(shop_id, code) DO UPDATE SET percent = excluded.percent, active = 1",
  ).run(shopId, normCode(code), percent);
}

export const setPromoActive = (shopId: number, code: string, active: boolean) =>
  db.prepare("UPDATE promos SET active = ? WHERE shop_id = ? AND code = ?").run(active ? 1 : 0, shopId, normCode(code)).changes > 0;

export const usePromo = (shopId: number, code: string) =>
  void db.prepare("UPDATE promos SET uses = uses + 1 WHERE shop_id = ? AND code = ?").run(shopId, normCode(code));

/** Sets a percentage discount (keeping the original as old_price), or restores the original price when percent is null. */
export function setDiscount(id: number, shopId: number, percent: number | null): boolean {
  const p = getProduct(id);
  if (!p || p.shop_id !== shopId || p.price == null) return false;
  const base = p.old_price ?? p.price;
  if (percent == null) {
    db.prepare("UPDATE products SET price = ?, old_price = NULL WHERE id = ?").run(base, id);
  } else {
    db.prepare("UPDATE products SET price = ?, old_price = ? WHERE id = ?").run(Math.round(base * (1 - percent / 100)), base, id);
  }
  return true;
}

export const setCategory = (id: number, shopId: number, category: string) =>
  db.prepare("UPDATE products SET category = ? WHERE id = ? AND shop_id = ?").run(category.trim().slice(0, 30), id, shopId).changes > 0;

export const shopCategories = (shopId: number): string[] =>
  (db.prepare("SELECT DISTINCT category FROM products WHERE shop_id = ? AND category != '' ORDER BY category").all(shopId) as { category: string }[]).map(
    (r) => r.category,
  );

export const shopAdminIds = (shop: Shop): number[] => [
  shop.tg_id,
  ...(db.prepare("SELECT tg_id FROM shop_admins WHERE shop_id = ?").all(shop.id) as { tg_id: number }[]).map((r) => r.tg_id),
];

export function createInvite(shopId: number): string {
  const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  db.prepare("INSERT INTO invites (token, shop_id) VALUES (?, ?)").run(token, shopId);
  return token;
}

/** Consumes an invite and makes the user an admin of that shop. */
export function acceptInvite(token: string, tgId: number): Shop | undefined {
  const inv = db.prepare("SELECT shop_id FROM invites WHERE token = ?").get(token) as { shop_id: number } | undefined;
  if (!inv) return undefined;
  db.prepare("DELETE FROM invites WHERE token = ?").run(token);
  db.prepare("INSERT OR IGNORE INTO shop_admins (shop_id, tg_id) VALUES (?, ?)").run(inv.shop_id, tgId);
  return getShopById(inv.shop_id);
}

export const removeAdmin = (shopId: number, tgId: number) =>
  db.prepare("DELETE FROM shop_admins WHERE shop_id = ? AND tg_id = ?").run(shopId, tgId).changes > 0;

// --- buyers & broadcasts ---
db.exec(`
CREATE TABLE IF NOT EXISTS buyers (
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  tg_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  can_write INTEGER NOT NULL DEFAULT 0,
  blocked INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_id, tg_id)
);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY,
  shop_id INTEGER NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

/** Remembers a buyer. canWrite=true means the bot may message them (they started the bot or allowed it in the Mini App). */
export function upsertBuyer(shopId: number, tgId: number, name: string, canWrite?: boolean) {
  db.prepare(
    `INSERT INTO buyers (shop_id, tg_id, name, can_write) VALUES (?,?,?,?)
     ON CONFLICT(shop_id, tg_id) DO UPDATE SET
       name = CASE WHEN excluded.name != '' THEN excluded.name ELSE buyers.name END,
       last_seen = CURRENT_TIMESTAMP,
       can_write = CASE WHEN ? = 1 THEN 1 ELSE buyers.can_write END,
       blocked = CASE WHEN ? = 1 THEN 0 ELSE buyers.blocked END`,
  ).run(shopId, tgId, name, canWrite ? 1 : 0, canWrite ? 1 : 0, canWrite ? 1 : 0);
}

export const broadcastTargets = (shopId: number) =>
  (db.prepare("SELECT tg_id FROM buyers WHERE shop_id = ? AND can_write = 1 AND blocked = 0").all(shopId) as { tg_id: number }[]).map((r) => r.tg_id);

export const buyerCounts = (shopId: number) =>
  db.prepare("SELECT COUNT(*) AS total, SUM(can_write = 1 AND blocked = 0) AS reachable FROM buyers WHERE shop_id = ?").get(shopId) as {
    total: number;
    reachable: number | null;
  };

export const markBuyerBlocked = (shopId: number, tgId: number) =>
  void db.prepare("UPDATE buyers SET blocked = 1 WHERE shop_id = ? AND tg_id = ?").run(shopId, tgId);

export const broadcastsToday = (shopId: number) =>
  (db.prepare("SELECT COUNT(*) AS n FROM broadcasts WHERE shop_id = ? AND created_at > datetime('now', '-1 day')").get(shopId) as { n: number }).n;

export const logBroadcast = (shopId: number, sent: number, failed: number) =>
  void db.prepare("INSERT INTO broadcasts (shop_id, sent, failed) VALUES (?,?,?)").run(shopId, sent, failed);
