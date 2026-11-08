/**
 * Draws the PWA icons (a white medical cross on PharmaFlow blue) with no image library:
 * it rasterises a few rounded rectangles with 4x4 supersampling and writes plain PNG files.
 * Run it with: node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const BLUE = [2, 132, 199]; // --color-medical
const GREEN = [16, 185, 129]; // --color-eco
const WHITE = [255, 255, 255];

/** Is the point inside a rounded rectangle centred at (cx, cy)? */
function inside(x, y, cx, cy, halfW, halfH, r) {
  const dx = Math.abs(x - cx) - (halfW - r);
  const dy = Math.abs(y - cy) - (halfH - r);
  if (dx <= 0 || dy <= 0) return Math.abs(x - cx) <= halfW && Math.abs(y - cy) <= halfH;
  return dx * dx + dy * dy <= r * r;
}

/**
 * `maskable` icons fill the whole square (the phone crops them to a circle or squircle), and keep the
 * cross inside the central safe zone. Normal icons have rounded corners and a slightly bigger cross.
 */
function pixel(x, y, size, maskable) {
  const c = size / 2;
  const cornerRadius = maskable ? 0 : size * 0.22;
  if (!inside(x, y, c, c, c, c, cornerRadius)) return null;

  const scale = maskable ? 0.8 : 1;
  const arm = size * 0.2 * scale;
  const len = size * 0.58 * scale;
  const onCross =
    inside(x, y, c, c, arm / 2, len / 2, arm / 2) || inside(x, y, c, c, len / 2, arm / 2, arm / 2);
  if (onCross) {
    // A small green dot in the middle of the cross, for the "eco" half of PharmaFlow.
    return inside(x, y, c, c, arm * 0.26, arm * 0.26, arm * 0.26) ? GREEN : WHITE;
  }
  return BLUE;
}

function render(size, maskable) {
  const SS = 4;
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const colour = pixel(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS, size, maskable);
          if (colour) { r += colour[0]; g += colour[1]; b += colour[2]; hits++; }
        }
      }
      const i = (py * size + px) * 4;
      if (hits > 0) {
        rgba[i] = Math.round(r / hits);
        rgba[i + 1] = Math.round(g / hits);
        rgba[i + 2] = Math.round(b / hits);
      }
      rgba[i + 3] = Math.round((hits / (SS * SS)) * 255);
    }
  }
  return rgba;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const FILES = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size, maskable] of FILES) {
  writeFileSync(join(out, name), png(size, render(size, maskable)));
  console.log(`wrote public/icons/${name} (${size}x${size}${maskable ? ', maskable' : ''})`);
}
