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
});

export function getOrCreateShop(tgId: number, displayName: string): Shop {
  const found = db.prepare("SELECT * FROM shops WHERE tg_id = ?").get(tgId) as Shop | undefined;
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

export function updateShop(id: number, fields: Partial<Pick<Shop, "name" | "contact" | "payment">>) {
  if (fields.name !== undefined) db.prepare("UPDATE shops SET name = ? WHERE id = ?").run(fields.name, id);
  if (fields.payment !== undefined) db.prepare("UPDATE shops SET payment = ? WHERE id = ?").run(fields.payment, id);
  if (fields.contact !== undefined) db.prepare("UPDATE shops SET contact = ? WHERE id = ?").run(fields.contact, id);
}

export function addProduct(p: Omit<Product, "id">, src?: { chat: number; msg: number }): Product {
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
  status: OrderStatus;
  created_at: string;
}

export interface OrderItem {
  product_id: number;
  title: string;
  price: number | null;
  currency: string;
  qty: number;
}

export function createOrder(
  shopId: number,
  customer: { name: string; phone: string; address: string; note: string },
  items: { product: Product; qty: number }[],
): Order {
  const totals = new Map<string, number>();
  for (const { product, qty } of items) {
    if (product.price != null) totals.set(product.currency, (totals.get(product.currency) ?? 0) + product.price * qty);
  }
  const total = [...totals].map(([c, v]) => `${new Intl.NumberFormat("ru-RU").format(v)} ${c}`).join(" + ");
  const tx = db.transaction(() => {
    const id = Number(
      db
        .prepare("INSERT INTO orders (shop_id, name, phone, address, note, total) VALUES (?,?,?,?,?,?)")
        .run(shopId, customer.name, customer.phone, customer.address, customer.note, total).lastInsertRowid,
    );
    const ins = db.prepare("INSERT INTO order_items (order_id, product_id, title, price, currency, qty) VALUES (?,?,?,?,?,?)");
    for (const { product, qty } of items) {
      ins.run(id, product.id, product.translations.uz.title, product.price, product.currency, qty);
    }
    return id;
  });
  return getOrder(tx())!;
}

export const getOrder = (id: number) => db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;

export const getOrderItems = (orderId: number) =>
  db.prepare("SELECT product_id, title, price, currency, qty FROM order_items WHERE order_id = ?").all(orderId) as OrderItem[];

export const listOrders = (shopId: number, limit = 10) =>
  db.prepare("SELECT * FROM orders WHERE shop_id = ? ORDER BY id DESC LIMIT ?").all(shopId, limit) as Order[];

export function setOrderStatus(id: number, shopId: number, status: OrderStatus): boolean {
  return db.prepare("UPDATE orders SET status = ? WHERE id = ? AND shop_id = ?").run(status, id, shopId).changes > 0;
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
