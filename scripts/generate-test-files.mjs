/**
 * T11 test file generator.
 * Replicates asepriteWriter.ts + exportAseprite.ts logic in plain Node.js
 * (no TypeScript compilation needed) and writes .aseprite files to /tmp.
 */

import { createWriteStream, writeFileSync } from 'fs';
import { zlibSync } from '../node_modules/fflate/esm/browser.js';

// ─── BinaryWriter ────────────────────────────────────────────────────────────

class BinaryWriter {
  #buf;
  #view;
  #pos = 0;

  constructor(cap = 4096) {
    this.#buf = new ArrayBuffer(cap);
    this.#view = new DataView(this.#buf);
  }

  get position() { return this.#pos; }

  #ensure(n) {
    if (this.#pos + n <= this.#buf.byteLength) return;
    let s = this.#buf.byteLength;
    while (s < this.#pos + n) s *= 2;
    const nb = new ArrayBuffer(s);
    new Uint8Array(nb).set(new Uint8Array(this.#buf));
    this.#buf = nb;
    this.#view = new DataView(this.#buf);
  }

  writeByte(v)  { this.#ensure(1); this.#view.setUint8(this.#pos, v);          this.#pos += 1; }
  writeWord(v)  { this.#ensure(2); this.#view.setUint16(this.#pos, v, true);   this.#pos += 2; }
  writeShort(v) { this.#ensure(2); this.#view.setInt16(this.#pos, v, true);    this.#pos += 2; }
  writeDword(v) { this.#ensure(4); this.#view.setUint32(this.#pos, v, true);   this.#pos += 4; }
  writeZeros(n) { this.#ensure(n); this.#pos += n; }

  writeBytes(bytes) {
    this.#ensure(bytes.length);
    new Uint8Array(this.#buf).set(bytes, this.#pos);
    this.#pos += bytes.length;
  }

  writeString(s) {
    const bytes = new TextEncoder().encode(s);
    this.writeWord(bytes.length);
    this.writeBytes(bytes);
  }

  patchDword(offset, v) {
    this.#view.setUint32(offset, v, true);
  }

  toUint8Array() { return new Uint8Array(this.#buf, 0, this.#pos); }
  getBuffer()    { return this.#buf.slice(0, this.#pos); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function wrapChunk(type, data) {
  const w = new BinaryWriter(6 + data.length);
  w.writeDword(6 + data.length);
  w.writeWord(type);
  w.writeBytes(data);
  return w.toUint8Array();
}

// ─── Chunk generators ────────────────────────────────────────────────────────

function generateHeader(width, height, numColors) {
  const w = new BinaryWriter(128);
  w.writeDword(0);        // file size placeholder
  w.writeWord(0xA5E0);    // magic
  w.writeWord(1);         // frames
  w.writeWord(width);
  w.writeWord(height);
  w.writeWord(32);        // RGBA
  w.writeDword(1);        // flags
  w.writeWord(100);       // speed
  w.writeDword(0); w.writeDword(0);
  w.writeByte(0);
  w.writeZeros(3);
  w.writeWord(numColors);
  w.writeByte(1); w.writeByte(1);
  w.writeShort(0); w.writeShort(0);
  w.writeWord(0); w.writeWord(0);
  w.writeZeros(84);
  const b = w.toUint8Array();
  if (b.length !== 128) throw new Error('Header size wrong: ' + b.length);
  return b;
}

function generateColorProfileChunk() {
  const d = new BinaryWriter(16);
  d.writeWord(1); d.writeWord(0); d.writeDword(0); d.writeZeros(8);
  return wrapChunk(0x2007, d.toUint8Array());
}

function generateLayerChunk(name = 'Background') {
  const d = new BinaryWriter(64);
  d.writeWord(1); d.writeWord(0); d.writeWord(0);
  d.writeWord(0); d.writeWord(0); d.writeWord(0);
  d.writeByte(255); d.writeZeros(3);
  d.writeString(name);
  return wrapChunk(0x2004, d.toUint8Array());
}

function generatePaletteChunk(colors) {
  if (colors.length === 0) {
    const d = new BinaryWriter(20);
    d.writeDword(0); d.writeDword(0); d.writeDword(0); d.writeZeros(8);
    return wrapChunk(0x2019, d.toUint8Array());
  }
  const d = new BinaryWriter(32 + colors.length * 6);
  d.writeDword(colors.length);
  d.writeDword(0);
  d.writeDword(colors.length - 1);
  d.writeZeros(8);
  for (const hex of colors) {
    const [r,g,b] = hexToRgb(hex);
    d.writeWord(0); d.writeByte(r); d.writeByte(g); d.writeByte(b); d.writeByte(255);
  }
  return wrapChunk(0x2019, d.toUint8Array());
}

function pixelGridToRGBA(grid, selectedColors) {
  const rgba = new Uint8Array(grid.width * grid.height * 4);
  const coordMap = new Map(grid.pixels.map(p => [`${p.x},${p.y}`, p.color]));
  const colorSet = selectedColors ? new Set(selectedColors) : null;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const color = coordMap.get(`${x},${y}`);
      if (!color) continue;
      if (colorSet && !colorSet.has(color)) continue;
      const [r,g,b] = hexToRgb(color);
      const i = (y * grid.width + x) * 4;
      rgba[i] = r; rgba[i+1] = g; rgba[i+2] = b; rgba[i+3] = 255;
    }
  }
  return rgba;
}

function generateCelChunk(width, height, rawPixels) {
  const compressed = zlibSync(rawPixels);
  console.log(`  Cel: ${rawPixels.length}B raw → ${compressed.length}B compressed (${(compressed.length/rawPixels.length*100).toFixed(1)}%)`);
  const d = new BinaryWriter(32 + compressed.length);
  d.writeWord(0); d.writeShort(0); d.writeShort(0);
  d.writeByte(255); d.writeWord(2); d.writeShort(0);
  d.writeZeros(5);
  d.writeWord(width); d.writeWord(height);
  d.writeBytes(compressed);
  return wrapChunk(0x2005, d.toUint8Array());
}

function generateFrame(chunks) {
  const chunksSize = chunks.reduce((s,c) => s+c.length, 0);
  const frameSize = 16 + chunksSize;
  const w = new BinaryWriter(frameSize);
  w.writeDword(frameSize);
  w.writeWord(0xF1FA);
  w.writeWord(Math.min(chunks.length, 0xFFFF));
  w.writeWord(100);
  w.writeZeros(2);
  w.writeDword(chunks.length);
  for (const c of chunks) w.writeBytes(c);
  return w.toUint8Array();
}

function generateAsepriteFile(grid, selectedColors) {
  const { width, height } = grid;
  const paletteColors = selectedColors && selectedColors.length > 0
    ? grid.uniqueColors.filter(c => selectedColors.includes(c))
    : grid.uniqueColors;

  const cpChunk  = generateColorProfileChunk();
  const layChunk = generateLayerChunk('Background');
  const palChunk = generatePaletteChunk(paletteColors);
  const rawPx    = pixelGridToRGBA(grid, selectedColors);
  const celChunk = generateCelChunk(width, height, rawPx);
  const frame    = generateFrame([cpChunk, layChunk, palChunk, celChunk]);
  const header   = generateHeader(width, height, paletteColors.length);

  const totalSize = header.length + frame.length;
  const fileBuf   = new ArrayBuffer(totalSize);
  const fileBytes = new Uint8Array(fileBuf);
  fileBytes.set(header, 0);
  fileBytes.set(frame, header.length);
  new DataView(fileBuf).setUint32(0, totalSize, true);
  return fileBuf;
}

// ─── Test cases ──────────────────────────────────────────────────────────────

function makeGrid(width, height, colors) {
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push({ x, y, color: colors[(y * width + x) % colors.length] });
    }
  }
  return { width, height, pixels, uniqueColors: [...new Set(colors)] };
}

function makeCheckerboard(width, height, c1, c2) {
  const pixels = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels.push({ x, y, color: (x + y) % 2 === 0 ? c1 : c2 });
  return { width, height, pixels, uniqueColors: [c1, c2] };
}

const TESTS = [
  {
    name: 'tc1-8x8-4colors',
    label: 'TC1: 8×8, 4 colors',
    grid: makeGrid(8, 8, ['#FF0000','#00FF00','#0000FF','#FFFF00']),
  },
  {
    name: 'tc2-32x32-16colors',
    label: 'TC2: 32×32, 16 colors',
    grid: makeGrid(32, 32, [
      '#000000','#111111','#222222','#333333','#444444','#555555','#666666','#777777',
      '#888888','#999999','#aaaaaa','#bbbbbb','#cccccc','#dddddd','#eeeeee','#ffffff',
    ]),
  },
  {
    name: 'tc3-64x64-32colors',
    label: 'TC3: 64×64, 32 colors',
    grid: makeGrid(64, 64, Array.from({length:32}, (_,i) => {
      const v = Math.round(i * 255 / 31).toString(16).padStart(2,'0');
      return `#${v}${v}${v}`;
    })),
  },
  {
    name: 'tc4-color-filter',
    label: 'TC4: Color filtering (only red/blue of 4 colors)',
    grid: makeCheckerboard(16, 16, '#FF0000', '#0000FF'),
    // we'll export with all colors selected, then check separately with filter
  },
  {
    name: 'tc4-filtered',
    label: 'TC4: Color filtering — only red visible',
    grid: makeCheckerboard(16, 16, '#FF0000', '#0000FF'),
    selectedColors: ['#FF0000'],
  },
  {
    name: 'tc5-1x1',
    label: 'TC5 edge: 1×1 pixel',
    grid: { width:1, height:1, pixels:[{x:0,y:0,color:'#FF00FF'}], uniqueColors:['#FF00FF'] },
  },
  {
    name: 'tc6-monochrome',
    label: 'TC6 edge: monochrome (1 color)',
    grid: makeGrid(16, 16, ['#123456']),
  },
];

// ─── Write files ─────────────────────────────────────────────────────────────

const outDir = '/tmp/aseprite-t11';
import { mkdirSync } from 'fs';
mkdirSync(outDir, { recursive: true });

console.log('Generating T11 test files...\n');

const results = [];
for (const tc of TESTS) {
  process.stdout.write(`${tc.label}\n`);
  try {
    const buf = generateAsepriteFile(tc.grid, tc.selectedColors);
    const path = `${outDir}/${tc.name}.aseprite`;
    writeFileSync(path, Buffer.from(buf));

    // Structural validation
    const view = new DataView(buf);
    const fileSize  = view.getUint32(0, true);
    const magic     = view.getUint16(4, true);
    const frames    = view.getUint16(6, true);
    const w         = view.getUint16(8, true);
    const h         = view.getUint16(10, true);
    const depth     = view.getUint16(12, true);
    const frameMag  = view.getUint16(128 + 4, true);
    const nChunks   = view.getUint32(128 + 12, true);

    const ok = magic === 0xA5E0 && fileSize === buf.byteLength && frameMag === 0xF1FA
               && w === tc.grid.width && h === tc.grid.height && depth === 32 && nChunks === 4;

    results.push({ label: tc.label, path, size: buf.byteLength, w, h, ok });
    console.log(`  → ${path} (${buf.byteLength}B) ${ok ? '✅' : '❌'}`);
    if (!ok) {
      console.log(`    magic:${magic.toString(16)} fileSize:${fileSize}/${buf.byteLength} frameMag:${frameMag.toString(16)} dims:${w}×${h} depth:${depth} chunks:${nChunks}`);
    }
  } catch (err) {
    results.push({ label: tc.label, ok: false, error: err.message });
    console.log(`  ❌ ERROR: ${err.message}`);
  }
  console.log();
}

console.log('─'.repeat(60));
const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} test cases passed structurally`);
console.log(`\nFiles written to: ${outDir}/`);
console.log('\nNow open each file in Aseprite to verify visually.');
