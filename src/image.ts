import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DATA_DIR } from "./db.js";

const REMOVEBG_KEY = process.env.REMOVEBG_API_KEY;
export const hasRemoveBg = !!REMOVEBG_KEY;

/** Cheap automatic touch-up applied to every uploaded photo: upright, bounded size, a bit of contrast and sharpness. */
export async function enhance(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .normalise({ lower: 2, upper: 98 })
    .sharpen()
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** Replaces the background of a stored photo with white (remove.bg). Returns the new file name. */
export async function whiteBackground(fileName: string): Promise<string> {
  if (!REMOVEBG_KEY) throw new Error("REMOVEBG_API_KEY is not set");
  const base = fileName.replace(/(-w)?\.[a-z]+$/, "");
  if (fileName.endsWith("-w.jpg")) return fileName;
  const origPath = `${DATA_DIR}/photos/${base}.orig`;
  const src = readFileSync(existsSync(origPath) ? origPath : `${DATA_DIR}/photos/${fileName}`);

  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(src)]), "photo.jpg");
  form.append("size", "auto");
  form.append("bg_color", "ffffff");
  form.append("format", "jpg");
  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": REMOVEBG_KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`remove.bg ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = `${base}-w.jpg`;
  writeFileSync(`${DATA_DIR}/photos/${out}`, Buffer.from(await res.arrayBuffer()));
  return out;
}
