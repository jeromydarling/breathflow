/**
 * Generates the raster brand assets that have to exist as real files:
 * the Open Graph card and the PWA icons.
 *
 * Written by hand rather than pulled from an image library because the shapes
 * are pure maths (radial gradients over a linear background) and adding a
 * canvas dependency to a Workers project for six PNGs is not a trade worth
 * making. Run with: node scripts/generate-assets.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public");
mkdirSync(OUT, { recursive: true });

// ── Minimal PNG encoder (truecolour, 8-bit, no alpha) ──────────────────────

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Brand rendering ────────────────────────────────────────────────────────

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const mix = (a, b, t) => a + (b - a) * t;

/** The Dawn Glow gradient from the design system, plus a breathing orb. */
function renderBrandCanvas(width, height, orbScale = 0.34) {
  const rgb = Buffer.alloc(width * height * 3);

  // Vertical gradient stops: charcoal → copper → amber.
  const stops = [
    [0.0, [23, 26, 24]],
    [0.45, [61, 36, 24]],
    [0.78, [155, 98, 61]],
    [1.0, [194, 138, 58]],
  ];

  const cx = width * 0.5;
  const cy = height * 0.46;
  const orbRadius = Math.min(width, height) * orbScale;

  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);

    let base = stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1];
        const [t1, c1] = stops[i];
        const local = (t - t0) / (t1 - t0);
        base = [
          mix(c0[0], c1[0], local),
          mix(c0[1], c1[1], local),
          mix(c0[2], c1[2], local),
        ];
        break;
      }
      base = stops[i][1];
    }

    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy) / orbRadius;

      // The sphere itself: full to its edge, then a soft shoulder so it does
      // not cut hard against the background.
      const body = Math.pow(Math.max(0, 1 - distance), 0.85);

      // A specular highlight up and left of centre, multiplied by the body so
      // it stays *on* the sphere instead of smearing past its edge.
      const sx = dx + orbRadius * 0.3;
      const sy = dy + orbRadius * 0.32;
      const specularDistance = Math.sqrt(sx * sx + sy * sy) / (orbRadius * 0.6);
      const specular = Math.exp(-specularDistance * specularDistance * 2.1);

      // A wide, faint halo so the orb sits in the scene rather than on it.
      const halo = Math.pow(Math.max(0, 1 - distance / 3), 3) * 0.16;

      const light = Math.min(1, body * 0.5 + body * specular * 0.6 + halo);

      const offset = (y * width + x) * 3;
      rgb[offset] = clamp(mix(base[0], 250, light));
      rgb[offset + 1] = clamp(mix(base[1], 232, light * 0.9));
      rgb[offset + 2] = clamp(mix(base[2], 205, light * 0.72));
    }
  }

  return rgb;
}

// ── Write the files ────────────────────────────────────────────────────────

const targets = [
  { name: "og-default.png", width: 1200, height: 630, scale: 0.3 },
  // Icons are cropped to a circle by the OS, so the orb sits larger in frame.
  { name: "icon-192.png", width: 192, height: 192, scale: 0.4 },
  { name: "icon-512.png", width: 512, height: 512, scale: 0.4 },
  { name: "apple-touch-icon.png", width: 180, height: 180, scale: 0.4 },
];

for (const target of targets) {
  const rgb = renderBrandCanvas(target.width, target.height, target.scale);
  const png = encodePng(target.width, target.height, rgb);
  writeFileSync(join(OUT, target.name), png);
  console.log(`wrote public/${target.name} (${png.length} bytes)`);
}
