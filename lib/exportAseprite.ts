/**
 * High-level Aseprite export function.
 *
 * Assembles all chunks into a complete .aseprite binary file and
 * triggers a browser download.
 *
 * Chunk assembly order (matches Aseprite spec expectations):
 *   Color Profile → Layer → Palette → Cel
 */

import { PixelGrid } from './pixelate';
import {
  generateHeader,
  generateColorProfileChunk,
  generateLayerChunk,
  generatePaletteChunk,
  generateCelChunk,
  generateFrame,
  pixelGridToRGBA,
} from './asepriteWriter';

/**
 * Generate a complete .aseprite file from a PixelGrid.
 *
 * @param pixelGrid  The pixel grid to export
 * @param selectedColors  Optional color filter — pixels not in this list become transparent
 * @returns ArrayBuffer containing the complete .aseprite binary
 */
export function generateAsepriteFile(
  pixelGrid: PixelGrid,
  selectedColors?: string[]
): ArrayBuffer {
  const { width, height } = pixelGrid;

  if (width === 0 || height === 0) {
    throw new Error('Pixel grid dimensions must be greater than zero');
  }
  if (pixelGrid.pixels.length === 0) {
    throw new Error('Pixel grid contains no pixels');
  }
  if (width > 200 || height > 200) {
    throw new Error('Maximum export size is 200×200 pixels');
  }

  // Determine the palette: intersection of uniqueColors and selectedColors (if provided)
  const paletteColors = selectedColors && selectedColors.length > 0
    ? pixelGrid.uniqueColors.filter(c => selectedColors.includes(c))
    : pixelGrid.uniqueColors;

  const numColors = paletteColors.length;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[aseprite] Exporting ${width}×${height}, ${numColors} colors`);
  }

  // 1. Generate all chunks (order matters)
  const colorProfileChunk = generateColorProfileChunk();
  const layerChunk        = generateLayerChunk('Background');
  const paletteChunk      = generatePaletteChunk(paletteColors);

  const rawPixels         = pixelGridToRGBA(pixelGrid, selectedColors);
  const celChunk          = generateCelChunk(width, height, rawPixels);

  // 2. Assemble frame
  const frame = generateFrame([colorProfileChunk, layerChunk, paletteChunk, celChunk]);

  // 3. Build header (numColors: pass actual count; 0 would mean 256 per spec)
  const header = generateHeader(width, height, numColors);

  // 4. Combine header + frame into final buffer
  const totalSize = header.length + frame.length;
  const fileBuffer = new ArrayBuffer(totalSize);
  const fileBytes  = new Uint8Array(fileBuffer);

  fileBytes.set(header, 0);
  fileBytes.set(frame,  header.length);

  // 5. Back-patch file size at offset 0 (DWORD, little-endian)
  const view = new DataView(fileBuffer);
  view.setUint32(0, totalSize, true);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[aseprite] File size: ${totalSize} bytes`);
    // Verify magic number at offset 4
    const magic = view.getUint16(4, true);
    console.log(`[aseprite] Magic: 0x${magic.toString(16).toUpperCase()} ${magic === 0xA5E0 ? '✅' : '❌ WRONG'}`);
  }

  return fileBuffer;
}

/**
 * Trigger a browser download of an .aseprite ArrayBuffer.
 *
 * Follows the same pattern as downloadSvg() in lib/exportSvg.ts.
 *
 * @param fileBuffer  ArrayBuffer from generateAsepriteFile()
 * @param filename    Download filename (default: 'pixel-art.aseprite')
 */
export function downloadAseprite(
  fileBuffer: ArrayBuffer,
  filename = 'pixel-art.aseprite'
) {
  const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
