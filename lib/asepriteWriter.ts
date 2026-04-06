/**
 * Aseprite binary file writer utilities.
 *
 * Aseprite file format reference:
 * https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
 *
 * All multi-byte integers are stored in Intel (little-endian) byte order.
 */

import { zlibSync } from 'fflate';
import { PixelGrid } from './pixelate';

// ---------------------------------------------------------------------------
// BinaryWriter
// ---------------------------------------------------------------------------

/**
 * A growable buffer with DataView-backed little-endian write helpers.
 *
 * Byte-order reminder: every `set*` call on DataView must pass `true` as the
 * last argument to select little-endian mode.  Big-endian writes silently
 * corrupt the file because Aseprite's parser assumes Intel byte order.
 */
export class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private pos: number = 0;

  constructor(initialCapacity = 4096) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buffer);
  }

  /** Current write position in bytes. */
  get position(): number {
    return this.pos;
  }

  // ---- private helpers ----

  private ensureCapacity(needed: number) {
    if (this.pos + needed <= this.buffer.byteLength) return;

    let newSize = this.buffer.byteLength;
    while (newSize < this.pos + needed) newSize *= 2;

    const next = new ArrayBuffer(newSize);
    new Uint8Array(next).set(new Uint8Array(this.buffer));
    this.buffer = next;
    this.view = new DataView(this.buffer);
  }

  // ---- public write methods ----

  /** Write an 8-bit unsigned integer (BYTE). */
  writeByte(value: number) {
    this.ensureCapacity(1);
    this.view.setUint8(this.pos, value);
    this.pos += 1;
  }

  /** Write a 16-bit unsigned integer (WORD) in little-endian order. */
  writeWord(value: number) {
    this.ensureCapacity(2);
    this.view.setUint16(this.pos, value, true); // true = little-endian
    this.pos += 2;
  }

  /** Write a 16-bit signed integer (SHORT) in little-endian order. */
  writeShort(value: number) {
    this.ensureCapacity(2);
    this.view.setInt16(this.pos, value, true);
    this.pos += 2;
  }

  /** Write a 32-bit unsigned integer (DWORD) in little-endian order. */
  writeDword(value: number) {
    this.ensureCapacity(4);
    this.view.setUint32(this.pos, value, true);
    this.pos += 4;
  }

  /** Write a 32-bit signed integer (LONG) in little-endian order. */
  writeLong(value: number) {
    this.ensureCapacity(4);
    this.view.setInt32(this.pos, value, true);
    this.pos += 4;
  }

  /**
   * Write a length-prefixed UTF-8 string (STRING type in the spec).
   *
   * Format:  WORD byte_length  +  BYTE[byte_length]
   *
   * IMPORTANT: the length field holds the byte count, NOT the character
   * count.  These differ for multi-byte Unicode characters (e.g. emoji).
   * TextEncoder is used to get the correct byte representation.
   */
  writeString(value: string) {
    const bytes = new TextEncoder().encode(value);
    this.writeWord(bytes.length); // byte length, not char length
    this.writeBytes(bytes);
  }

  /** Write a raw byte array. */
  writeBytes(bytes: Uint8Array) {
    this.ensureCapacity(bytes.length);
    new Uint8Array(this.buffer).set(bytes, this.pos);
    this.pos += bytes.length;
  }

  /** Write `count` zero bytes. */
  writeZeros(count: number) {
    this.ensureCapacity(count);
    // ArrayBuffer is already zeroed; just advance the position.
    // If the buffer was re-allocated, the new region is also zeroed.
    this.pos += count;
  }

  /**
   * Overwrite a previously written DWORD at `offset` with `value`.
   * Used to back-patch chunk/frame/file sizes after the data is written.
   */
  patchDword(offset: number, value: number) {
    this.view.setUint32(offset, value, true);
  }

  /**
   * Return the written portion of the buffer as a Uint8Array (no copy).
   */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.pos);
  }

  /**
   * Return the written portion of the buffer as an ArrayBuffer (copy).
   */
  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.pos);
  }
}

// ---------------------------------------------------------------------------
// Header generator (T03)
// ---------------------------------------------------------------------------

/**
 * Generate the 128-byte Aseprite file header.
 *
 * Field offsets (little-endian):
 *  0  DWORD  file size (placeholder – caller must patch after assembly)
 *  4  WORD   magic 0xA5E0
 *  6  WORD   number of frames
 *  8  WORD   width in pixels
 * 10  WORD   height in pixels
 * 12  WORD   color depth (32 = RGBA)
 * 14  DWORD  flags (bit 0: layer opacity valid)
 * 18  WORD   speed (deprecated, ms between frames)
 * 20  DWORD  reserved (0)
 * 24  DWORD  reserved (0)
 * 28  BYTE   palette entry index for transparent color
 * 29  BYTE   reserved (×3)
 * 32  WORD   number of colors (0 means 256)
 * 34  BYTE   pixel width  (pixel ratio w)
 * 35  BYTE   pixel height (pixel ratio h)
 * 36  SHORT  X position of the grid
 * 38  SHORT  Y position of the grid
 * 40  WORD   grid width  (0 if no grid)
 * 42  WORD   grid height (0 if no grid)
 * 44  84 bytes of zero padding → total = 128
 */
export function generateHeader(width: number, height: number, numColors: number): Uint8Array {
  const w = new BinaryWriter(128);

  w.writeDword(0);        //  0: file size placeholder
  w.writeWord(0xA5E0);   //  4: magic number
  w.writeWord(1);         //  6: number of frames
  w.writeWord(width);     //  8: width
  w.writeWord(height);    // 10: height
  w.writeWord(32);        // 12: color depth (RGBA)
  w.writeDword(1);        // 14: flags – bit 0: layer opacity valid
  w.writeWord(100);       // 18: speed (deprecated)
  w.writeDword(0);        // 20: reserved
  w.writeDword(0);        // 24: reserved
  w.writeByte(0);         // 28: transparent palette entry index
  w.writeZeros(3);        // 29-31: reserved
  w.writeWord(numColors); // 32: number of colors (0 means 256)
  w.writeByte(1);         // 34: pixel width  (ratio 1:1)
  w.writeByte(1);         // 35: pixel height (ratio 1:1)
  w.writeShort(0);        // 36: grid X
  w.writeShort(0);        // 38: grid Y
  w.writeWord(0);         // 40: grid width  (0 = no grid)
  w.writeWord(0);         // 42: grid height (0 = no grid)
  w.writeZeros(84);       // 44-127: padding

  const bytes = w.toUint8Array();
  if (bytes.length !== 128) {
    throw new Error(`Header must be 128 bytes, got ${bytes.length}`);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Color Profile Chunk (0x2007) generator
// ---------------------------------------------------------------------------

/**
 * Generate a minimal sRGB Color Profile chunk (type 0x2007).
 *
 * This ensures Aseprite interprets colors correctly.
 * We use type=1 (sRGB) with no embedded ICC data.
 *
 * Chunk data layout:
 *   WORD  profile type: 0 = none, 1 = sRGB, 2 = embedded ICC
 *   WORD  flags: bit 0 = use special fixed gamma
 *   FIXED gamma (DWORD, 16.16 fixed point) – only relevant when flag bit 0 set
 *   BYTE[8] reserved
 */
export function generateColorProfileChunk(): Uint8Array {
  const data = new BinaryWriter(32);

  data.writeWord(1);      // profile type: sRGB
  data.writeWord(0);      // flags: no special gamma
  data.writeDword(0);     // gamma (not used when flag bit 0 is 0)
  data.writeZeros(8);     // reserved

  return wrapChunk(0x2007, data.toUint8Array());
}

// ---------------------------------------------------------------------------
// Layer Chunk (0x2004) generator (T05)
// ---------------------------------------------------------------------------

/**
 * Generate a Layer Chunk (type 0x2004) for a single visible image layer.
 *
 * Chunk data layout:
 *   WORD  flags (1 = visible)
 *   WORD  layer type (0 = normal image layer)
 *   WORD  child level (0 = top-level)
 *   WORD  default layer width (ignored)
 *   WORD  default layer height (ignored)
 *   WORD  blend mode (0 = Normal)
 *   BYTE  opacity (0-255)
 *   BYTE[3] reserved
 *   STRING layer name
 */
export function generateLayerChunk(name = 'Background'): Uint8Array {
  const data = new BinaryWriter(64);

  data.writeWord(1);    // flags: visible
  data.writeWord(0);    // layer type: normal image layer
  data.writeWord(0);    // child level: top-level
  data.writeWord(0);    // default width (ignored)
  data.writeWord(0);    // default height (ignored)
  data.writeWord(0);    // blend mode: Normal
  data.writeByte(255);  // opacity
  data.writeZeros(3);   // reserved
  data.writeString(name);

  return wrapChunk(0x2004, data.toUint8Array());
}

// ---------------------------------------------------------------------------
// Palette Chunk (0x2019) generator (T04)
// ---------------------------------------------------------------------------

/**
 * Parse a '#RRGGBB' hex color string into [r, g, b] components.
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Generate a New Palette Chunk (type 0x2019).
 *
 * Chunk data layout:
 *   DWORD  palette size (number of entries)
 *   DWORD  first color index to change
 *   DWORD  last color index to change
 *   BYTE[8] reserved
 *   For each entry:
 *     WORD  flags (0 = no name)
 *     BYTE  R, G, B, A
 */
export function generatePaletteChunk(colors: string[]): Uint8Array {
  if (colors.length === 0) {
    // Empty palette chunk – still valid per spec
    const data = new BinaryWriter(20);
    data.writeDword(0); // size
    data.writeDword(0); // first
    data.writeDword(0); // last
    data.writeZeros(8);
    return wrapChunk(0x2019, data.toUint8Array());
  }

  const data = new BinaryWriter(32 + colors.length * 6);

  data.writeDword(colors.length);         // palette size
  data.writeDword(0);                      // first color index to change
  data.writeDword(colors.length - 1);     // last color index to change
  data.writeZeros(8);                      // reserved

  for (const hex of colors) {
    const [r, g, b] = hexToRgb(hex);
    data.writeWord(0);   // flags: no name attached
    data.writeByte(r);
    data.writeByte(g);
    data.writeByte(b);
    data.writeByte(255); // alpha
  }

  return wrapChunk(0x2019, data.toUint8Array());
}

// ---------------------------------------------------------------------------
// Pixel data converter + Cel Chunk (0x2005) generator (T06)
// ---------------------------------------------------------------------------

/**
 * Convert a PixelGrid to a flat RGBA byte array (row-major, left-to-right).
 *
 * Missing pixel coordinates become transparent (alpha = 0).
 * If `selectedColors` is provided, pixels whose color is not in the set are
 * also made transparent.
 */
export function pixelGridToRGBA(grid: PixelGrid, selectedColors?: string[]): Uint8Array {
  const rgba = new Uint8Array(grid.width * grid.height * 4); // zeroed = transparent

  // Build a coordinate lookup map to avoid O(n) scans per pixel position.
  const coordMap = new Map<string, string>();
  for (const pixel of grid.pixels) {
    coordMap.set(`${pixel.x},${pixel.y}`, pixel.color);
  }

  const colorSet = selectedColors ? new Set(selectedColors) : null;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const color = coordMap.get(`${x},${y}`);
      if (!color) continue;                              // missing → transparent
      if (colorSet && !colorSet.has(color)) continue;   // filtered → transparent

      const [r, g, b] = hexToRgb(color);
      const idx = (y * grid.width + x) * 4;
      rgba[idx]     = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }

  return rgba;
}

/**
 * Generate a Cel Chunk (type 0x2005) containing compressed RGBA pixel data.
 *
 * Uses zlib compression (zlibSync from fflate), NOT raw deflate.
 * Aseprite's decoder calls inflateInit() which expects the full zlib wrapper
 * (2-byte header + DEFLATE data + 4-byte Adler-32 checksum).
 *
 * Chunk data layout:
 *   WORD   layer index (0 = first layer)
 *   SHORT  x position
 *   SHORT  y position
 *   BYTE   opacity (0-255)
 *   WORD   cel type (2 = compressed image)
 *   SHORT  z-index
 *   BYTE[5] reserved
 *   WORD   width
 *   WORD   height
 *   BYTE[] compressed pixel data
 */
export function generateCelChunk(width: number, height: number, rawPixels: Uint8Array): Uint8Array {
  const compressed = zlibSync(rawPixels);

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[aseprite] Cel compression: ${rawPixels.length} → ${compressed.length} bytes ` +
      `(${(compressed.length / rawPixels.length * 100).toFixed(1)}%)`
    );
  }

  const data = new BinaryWriter(32 + compressed.length);

  data.writeWord(0);    // layer index
  data.writeShort(0);   // x position
  data.writeShort(0);   // y position
  data.writeByte(255);  // opacity
  data.writeWord(2);    // cel type: compressed image
  data.writeShort(0);   // z-index
  data.writeZeros(5);   // reserved
  data.writeWord(width);
  data.writeWord(height);
  data.writeBytes(compressed);

  return wrapChunk(0x2005, data.toUint8Array());
}

// ---------------------------------------------------------------------------
// Frame generator (T07)
// ---------------------------------------------------------------------------

/**
 * Wrap a sequence of chunk byte arrays in a 16-byte frame header.
 *
 * Frame header layout:
 *   DWORD  bytes in frame (includes this 16-byte header)
 *   WORD   magic 0xF1FA
 *   WORD   old number of chunks (clamped to 0xFFFF)
 *   WORD   frame duration in milliseconds
 *   BYTE[2] reserved
 *   DWORD  new number of chunks (actual count)
 */
export function generateFrame(chunks: Uint8Array[]): Uint8Array {
  const chunksSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const frameSize = 16 + chunksSize;

  const w = new BinaryWriter(frameSize);

  w.writeDword(frameSize);                              // bytes in frame
  w.writeWord(0xF1FA);                                  // magic
  w.writeWord(Math.min(chunks.length, 0xFFFF));         // old chunk count
  w.writeWord(100);                                     // frame duration (ms)
  w.writeZeros(2);                                      // reserved
  w.writeDword(chunks.length);                          // new chunk count

  for (const chunk of chunks) {
    w.writeBytes(chunk);
  }

  return w.toUint8Array();
}

// ---------------------------------------------------------------------------
// Internal chunk wrapper helper
// ---------------------------------------------------------------------------

/**
 * Wrap raw chunk data bytes with the standard 6-byte chunk header.
 *
 * The spec defines chunk size as the total byte count INCLUDING the size
 * field itself (4 bytes) and the type field (2 bytes).  Getting this wrong
 * causes Aseprite to seek to the wrong offset when reading the next chunk,
 * which corrupts every subsequent chunk in the file.
 *
 * Layout:
 *   DWORD  total chunk size (= 6 + data.length)
 *   WORD   chunk type
 *   BYTE[] chunk data
 */
function wrapChunk(type: number, data: Uint8Array): Uint8Array {
  const totalSize = 6 + data.length; // 4 (size) + 2 (type) + data
  const w = new BinaryWriter(totalSize);
  w.writeDword(totalSize);
  w.writeWord(type);
  w.writeBytes(data);
  return w.toUint8Array();
}
