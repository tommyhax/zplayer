#!/usr/bin/env node
// Prepare local story inputs and the app artwork for the browser and native shell.
// Read story inputs from the pinned z submodule.
// Story files retain their existing terms, described in NOTICE.md.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const BINARIES = join(app, "z/historical/games/binaries");
const out = join(app, "public", "stories");
// The icons, all one drawing: the home-screen ones the manifest and the touch-icon link name,
// and the app's, which the Xcode project reads from its asset catalogue (RGB, no alpha, as
// the App Store requires). Drawn again on every stage so the two can never disagree. The
// launch screen is the same mark, small on the player's ground, in the catalogue's three
// scale slots (one image serves all: the storyboard scales it to fill the screen).
const ICONS = [
  ["public/icon.png", 180],
  ["public/icon-512.png", 512],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024],
];
const SPLASHES = ["", "-1", "-2"].map((n) => `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732${n}.png`);

const { titles } = JSON.parse(readFileSync(join(app, "titles.json"), "utf8"));
const retained = readdirSync(BINARIES);
const notices = ["LICENSE", "NOTICE.md"];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const manifest = [];
for (const { id, label } of titles) {
  // `<id>-s<serial>.z3`, and one of them: an id that matched two files would be ambiguous.
  const files = retained.filter((f) => f.startsWith(`${id}-s`) && f.endsWith(".z3"));
  if (files.length !== 1) throw new Error(`${id}: ${files.length === 0 ? "no story in the z submodule; run git submodule update --init --recursive" : `matches ${files.join(", ")}`}`);
  const file = files[0];
  const m = /-r(\d+)-s(\d{6})\.z3$/.exec(file);
  if (m === null) throw new Error(`${file}: not <title>-r<release>-s<serial>.z3`);
  copyFileSync(join(BINARIES, file), join(out, file));
  manifest.push({ id, label, file, release: Number(m[1]), serial: m[2] });
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ titles: manifest }, null, 2) + "\n");
for (const file of notices) copyFileSync(join(app, file), join(app, "public", file));
for (const [file, size] of ICONS) writeFileSync(join(app, file), icon(size));
const launch = splash(2732, 480);
for (const file of SPLASHES) writeFileSync(join(app, file), launch);
console.log(`staged ${manifest.length} stories into ${out}`);

/**
 * The icon: the desk's monitor in miniature. The slate case, the black recess with its wide
 * corners, the green glass with the tube's own gradient and the fall-off at its corners,
 * and on it the lit status bar, three lines of transcript, a prompt and the cursor, with
 * the phosphor's bloom round the lit strokes -- the same colours and proportions as
 * desk.css, at an icon's scale. Drawn here so the app needs no image asset checked in.
 * iOS masks the corners itself; the drawing fills the square.
 *
 * A small rasteriser: every shape is a signed distance, and a pixel's coverage is how far
 * inside the edge its centre falls, so edges are anti-aliased without supersampling.
 * Everything is laid out on a 1024 grid and placed on the canvas at a scale and offset.
 */
function icon(size) {
  return draw(size, { scale: size / 1024, x: 0, y: 0 });
}

/**
 * The launch screen: the mark as it sits on the home screen -- the case's corners rounded
 * as iOS rounds them, near a fifth of its side -- small in the middle of the player's own
 * ground (desk.css .desk-only), so the app opens on what it will show next.
 */
function splash(size, mark) {
  return draw(size, { scale: mark / 1024, x: (size - mark) / 2, y: (size - mark) / 2, ground: 0x0b0c0e, corner: 225 });
}

function draw(size, { scale: s, x: ox, y: oy, ground, corner = 0 }) {
  const N = size * size;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const rgb = (hex) => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const blend = (i, [r, g, b], a) => {
    R[i] += (r - R[i]) * a;
    G[i] += (g - G[i]) * a;
    B[i] += (b - B[i]) * a;
  };
  // Signed distance to a rounded rectangle (negative inside), in 1024 units.
  const rrect = (x, y, x0, y0, x1, y1, r) => {
    const dx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r);
    const dy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  };
  // Signed distance to a stroke with round ends, from (ax,ay) to (bx,by), w wide.
  const stroke = (x, y, ax, ay, bx, by, w) => {
    const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
    const t = clamp((px * vx + py * vy) / (vx * vx + vy * vy));
    return Math.hypot(px - vx * t, py - vy * t) - w / 2;
  };
  // Coverage of a pixel whose centre is d units (in 1024 space) from the edge.
  const cover = (d) => clamp(0.5 - d * s);
  // The pixels the grid covers: the loops below need visit no others.
  const x0 = Math.max(0, Math.floor(ox)), x1 = Math.min(size, Math.ceil(ox + 1024 * s));
  const y0 = Math.max(0, Math.floor(oy)), y1 = Math.min(size, Math.ceil(oy + 1024 * s));
  // Paint a shape over the whole canvas: colour(x, y) or a constant, and the alpha it takes.
  const paint = (sdf, colour, alpha = 1) => {
    const flat = Array.isArray(colour);
    for (let py = y0; py < y1; py++) {
      const y = (py + 0.5 - oy) / s;
      for (let px = x0; px < x1; px++) {
        const x = (px + 0.5 - ox) / s;
        const a = cover(sdf(x, y)) * alpha;
        if (a > 0) blend(py * size + px, flat ? colour : colour(x, y), a);
      }
    }
  };

  // The ground, if the drawing has one to sit on.
  if (ground !== undefined) {
    const [r, g, b] = rgb(ground);
    R.fill(r);
    G.fill(g);
    B.fill(b);
  }
  // The case: matte painted steel, the desk's flat slate with the faintest fall of light.
  const caseTop = rgb(0x616b77), caseBottom = rgb(0x57606b);
  paint((x, y) => rrect(x, y, 0, 0, 1024, 1024, corner), (x, y) => mix(caseTop, caseBottom, y / 1024));
  // The recess: black plastic, wide-radius corners.
  const recess = [84, 116, 940, 908];
  paint((x, y) => rrect(x, y, ...recess, 132), rgb(0x16171a));
  // The glass: the tube's radial gradient (desk.css .glass), centre a little above the middle.
  const glass = [156, 184, 868, 840];
  const gw = glass[2] - glass[0], gh = glass[3] - glass[1];
  const gcx = glass[0] + gw * 0.5, gcy = glass[1] + gh * 0.45;
  const g0 = rgb(0x1d2b23), g1 = rgb(0x141f19), g2 = rgb(0x0d1611);
  const glassSdf = (x, y) => rrect(x, y, ...glass, 76);
  paint(glassSdf, (x, y) => {
    const t = Math.hypot((x - gcx) / (gw * 1.1), (y - gcy) / (gh * 0.95));
    return t < 0.55 ? mix(g0, g1, t / 0.55) : mix(g1, g2, clamp((t - 0.55) / 0.45));
  });
  // The raster under the transcript: one dark line in three, as under the desk's text,
  // at the pitch of these lines. It averages to a faint tint at the small sizes.
  const rasterTop = 340, rasterBottom = glass[3];
  const pitch = 9;
  paint(
    (x, y) => {
      const inGlass = glassSdf(x, y);
      if (y < rasterTop || y > rasterBottom) return 1e9;
      const phase = (y - rasterTop) % pitch;
      return Math.max(inGlass, Math.max(phase - 3, -phase));
    },
    rgb(0x060e0a),
    0.22,
  );

  // What is lit. Each stroke goes into a coverage buffer for the bloom, then is painted.
  const ink = rgb(0xb8f4c6), soft = rgb(0x7dd39a), fringe = rgb(0x58e88a);
  const lit = [];
  const bar = [212, 250, 812, 314];
  lit.push([(x, y) => rrect(x, y, ...bar, 6), ink, 2.2]);
  const lines = [[386, 612], [458, 716], [530, 540]];
  for (const [cy, x1] of lines) lit.push([(x, y) => stroke(x, y, 212 + 15, cy, x1 - 15, cy, 30), soft, 1]);
  const py0 = 656;
  lit.push([(x, y) => Math.min(stroke(x, y, 226, py0 - 40, 276, py0, 30), stroke(x, y, 276, py0, 226, py0 + 40, 30)), ink, 1]);
  lit.push([(x, y) => rrect(x, y, 318, py0 - 38, 384, py0 + 38, 4), ink, 1.4]);

  // The bloom: the lit coverage, weighted by how hard each shape blooms, blurred twice --
  // a tight fringe in the phosphor's green and a wider, fainter spread -- and laid on the
  // glass only, as the desk's text-shadow is clipped by the glass's overflow.
  const glow = new Float32Array(N);
  for (const [sdf, , weight] of lit) {
    for (let py = y0; py < y1; py++) {
      const y = (py + 0.5 - oy) / s;
      for (let px = x0; px < x1; px++) {
        const a = cover(sdf((px + 0.5 - ox) / s, y));
        if (a > 0) glow[py * size + px] += a * weight;
      }
    }
  }
  const tight = blur(glow, size, 6 * s), wide = blur(glow, size, 24 * s);
  for (let py = y0; py < y1; py++) {
    const y = (py + 0.5 - oy) / s;
    for (let px = x0; px < x1; px++) {
      const i = py * size + px;
      const clip = cover(glassSdf((px + 0.5 - ox) / s, y));
      const a = clamp(tight[i] * 0.55 + wide[i] * 0.5) * clip;
      if (a > 0) blend(i, fringe, a);
    }
  }
  for (const [sdf, colour] of lit) paint(sdf, colour);

  // The curve of the tube, over everything on the glass (desk.css .glass::after): the
  // corners fall off into black, the centre stays what it is.
  const vcx = glass[0] + gw * 0.5, vcy = glass[1] + gh * 0.46;
  for (let py = y0; py < y1; py++) {
    const y = (py + 0.5 - oy) / s;
    for (let px = x0; px < x1; px++) {
      const x = (px + 0.5 - ox) / s;
      const t = Math.hypot((x - vcx) / (gw * 1.15), (y - vcy) / (gh * 0.9));
      const a = 0.42 * clamp((t - 0.62) / 0.38) * cover(glassSdf(x, y));
      if (a > 0) blend(py * size + px, [0, 0, 0], a);
    }
  }
  return png(size, size, R, G, B);
}

function blur(src, size, r) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const radius = Math.max(1, Math.round(r));
  const pass = (from, to, stride, step) => {
    // Sum over a window of 2*radius+1 along one axis, for every line of that axis.
    const lines = size, len = size;
    for (let l = 0; l < lines; l++) {
      const base = l * stride;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += from[base + clampIndex(k, len) * step];
      for (let i = 0; i < len; i++) {
        to[base + i * step] = sum / (2 * radius + 1);
        sum += from[base + clampIndex(i + radius + 1, len) * step] - from[base + clampIndex(i - radius, len) * step];
      }
    }
  };
  const clampIndex = (i, len) => (i < 0 ? 0 : i >= len ? len - 1 : i);
  for (let n = 0; n < 3; n++) {
    pass(a, b, size, 1); // rows: line stride = size, step 1
    pass(b, a, 1, size); // columns: line stride = 1, step = size
  }
  return a;
}

function png(width, height, R, G, B) {
  const raw = new Uint8Array(height * (width * 3 + 1));
  const byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = y * width + x, o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = byte(R[i]);
      raw[o + 1] = byte(G[i]);
      raw[o + 2] = byte(B[i]);
    }
  }
  const chunk = (type, data) => {
    const head = Buffer.from(type, "latin1");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head, data])));
    return Buffer.concat([length, head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB: the icon is opaque everywhere, and the App Store refuses an alpha channel
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
