export interface PixelGrid {
  pixels: Pixel[];
  width: number;
  height: number;
  uniqueColors: string[];
}

export interface Pixel {
  x: number;
  y: number;
  color: string; // hex format #RRGGBB
}

export interface PixelateOptions {
  pixelSize?: number; // scale factor (e.g., 10 = each pixel is 10x10 input pixels)
  maxDimension?: number; // max width or height in output pixels
  exactWidth?: number; // exact output width (takes priority over pixelSize)
  exactHeight?: number; // exact output height (takes priority over pixelSize)
  paletteSize?: number; // limit colors to N using k-means clustering (optional)
  colorPreset?: string[]; // snap colors to specific palette (optional)
  useDithering?: boolean; // apply Floyd-Steinberg dithering when reducing colors (optional)
}

import { quantizeColors } from './colorQuantize';
import { snapToNearestColor } from './colorPresets';
import { applyDithering } from './dithering';

export async function pixelateImage(
  file: File,
  options: PixelateOptions
): Promise<PixelGrid> {
  const { pixelSize, maxDimension, exactWidth, exactHeight, paletteSize, colorPreset, useDithering } = options;

  const img = await loadImage(file);
  const inputWidth  = img.width;
  const inputHeight = img.height;

  // ── Compute output dimensions ─────────────────────────────────────────────
  let outputWidth: number;
  let outputHeight: number;

  if (exactWidth && exactHeight) {
    outputWidth  = exactWidth;
    outputHeight = exactHeight;
  } else if (pixelSize) {
    outputWidth  = Math.max(1, Math.floor(inputWidth  / pixelSize));
    outputHeight = Math.max(1, Math.floor(inputHeight / pixelSize));

    if (maxDimension && (outputWidth > maxDimension || outputHeight > maxDimension)) {
      const scale  = Math.min(maxDimension / outputWidth, maxDimension / outputHeight);
      outputWidth  = Math.max(1, Math.floor(outputWidth  * scale));
      outputHeight = Math.max(1, Math.floor(outputHeight * scale));
    }
  } else {
    throw new Error('Either pixelSize or exactWidth/exactHeight must be provided');
  }

  // ── Draw full-res image to input canvas ───────────────────────────────────
  const inputCanvas = document.createElement('canvas');
  inputCanvas.width  = inputWidth;
  inputCanvas.height = inputHeight;
  const inputCtx = inputCanvas.getContext('2d', { willReadFrequently: true })!;
  inputCtx.drawImage(img, 0, 0);

  // ── Apply dithering if requested ──────────────────────────────────────────
  if (useDithering && (colorPreset || paletteSize)) {
    // Bulk-read the full image once for dithering
    const fullImageData = inputCtx.getImageData(0, 0, inputWidth, inputHeight);

    let targetPalette: string[] = [];

    if (colorPreset && colorPreset.length > 0) {
      targetPalette = colorPreset;
    } else if (paletteSize) {
      // Sample colours from the bulk buffer — no per-pixel getImageData calls
      const buf = fullImageData.data;
      const stride = Math.max(1, Math.floor(inputWidth / 100)); // sample ~100 cols
      const tempColorSet = new Set<string>();

      for (let y = 0; y < inputHeight; y += stride) {
        for (let x = 0; x < inputWidth; x += stride) {
          const i = (y * inputWidth + x) * 4;
          if (buf[i + 3] > 0) {
            tempColorSet.add(rgbToHex(buf[i], buf[i + 1], buf[i + 2]));
          }
        }
      }

      const tempColors = Array.from(tempColorSet);
      if (tempColors.length > paletteSize) {
        const colorMap = quantizeColors(tempColors, paletteSize);
        targetPalette = Array.from(new Set(colorMap.values()));
      } else {
        targetPalette = tempColors;
      }
    }

    if (targetPalette.length > 0) {
      console.log(`Applying dithering with ${targetPalette.length} colors...`);
      const dithered = applyDithering(fullImageData, targetPalette);
      inputCtx.putImageData(dithered, 0, 0);
    }
  }

  // ── Downscale to output dimensions in one drawImage call ──────────────────
  // Using the browser's GPU-accelerated bilinear resampling instead of
  // manual nearest-neighbour sampling via N × getImageData(x, y, 1, 1).
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width  = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })!;

  // Disable smoothing for a crisp pixelated result
  outputCtx.imageSmoothingEnabled = false;
  outputCtx.drawImage(inputCanvas, 0, 0, outputWidth, outputHeight);

  // ── Read all output pixels in one bulk call ───────────────────────────────
  const { data } = outputCtx.getImageData(0, 0, outputWidth, outputHeight);

  const pixels: Pixel[] = [];
  const colorSet = new Set<string>();

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const i = (y * outputWidth + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue; // skip fully transparent

      const color = rgbToHex(data[i], data[i + 1], data[i + 2]);
      colorSet.add(color);
      pixels.push({ x, y, color });
    }
  }

  let uniqueColors = Array.from(colorSet).sort();
  let finalPixels  = pixels;

  // ── Colour post-processing (preset snap / quantization) ───────────────────
  if (colorPreset && colorPreset.length > 0) {
    console.log(`Snapping colors to preset (${colorPreset.length} colors)...`);
    finalPixels = pixels.map(pixel => ({
      ...pixel,
      color: snapToNearestColor(pixel.color, colorPreset),
    }));
    const presetColorSet = new Set(finalPixels.map(p => p.color));
    uniqueColors = Array.from(presetColorSet).sort();
  } else if (paletteSize && uniqueColors.length > paletteSize) {
    console.log(`Quantizing ${uniqueColors.length} colors to ${paletteSize}...`);
    const colorMap = quantizeColors(uniqueColors, paletteSize);
    finalPixels = pixels.map(pixel => ({
      ...pixel,
      color: colorMap.get(pixel.color) || pixel.color,
    }));
    const quantizedColorSet = new Set(finalPixels.map(p => p.color));
    uniqueColors = Array.from(quantizedColorSet).sort();
  }

  console.log('Pixelation complete:', {
    outputWidth,
    outputHeight,
    totalPixels: finalPixels.length,
    uniqueColorCount: uniqueColors.length,
  });

  return {
    pixels: finalPixels,
    width:  outputWidth,
    height: outputHeight,
    uniqueColors,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
