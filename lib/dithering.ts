/**
 * Floyd-Steinberg dithering for color reduction
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Apply Floyd-Steinberg dithering to an image
 * @param imageData Canvas ImageData
 * @param palette Target color palette (hex strings)
 * @returns Modified ImageData with dithering applied
 */
export function applyDithering(
  imageData: ImageData,
  palette: string[]
): ImageData {
  if (palette.length === 0) return imageData;

  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);

  // Convert palette to RGB
  const paletteRgb = palette.map(hexToRgb);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const oldR = data[idx];
      const oldG = data[idx + 1];
      const oldB = data[idx + 2];

      // Find nearest palette color
      const nearest = findNearestColor({ r: oldR, g: oldG, b: oldB }, paletteRgb);
      
      // Set pixel to nearest color
      data[idx] = nearest.r;
      data[idx + 1] = nearest.g;
      data[idx + 2] = nearest.b;

      // Calculate quantization error
      const errR = oldR - nearest.r;
      const errG = oldG - nearest.g;
      const errB = oldB - nearest.b;

      // Distribute error to neighboring pixels (Floyd-Steinberg)
      // Right pixel (x+1, y)
      if (x + 1 < width) {
        const rightIdx = (y * width + (x + 1)) * 4;
        data[rightIdx] = clamp(data[rightIdx] + errR * 7 / 16);
        data[rightIdx + 1] = clamp(data[rightIdx + 1] + errG * 7 / 16);
        data[rightIdx + 2] = clamp(data[rightIdx + 2] + errB * 7 / 16);
      }

      // Bottom-left pixel (x-1, y+1)
      if (x > 0 && y + 1 < height) {
        const blIdx = ((y + 1) * width + (x - 1)) * 4;
        data[blIdx] = clamp(data[blIdx] + errR * 3 / 16);
        data[blIdx + 1] = clamp(data[blIdx + 1] + errG * 3 / 16);
        data[blIdx + 2] = clamp(data[blIdx + 2] + errB * 3 / 16);
      }

      // Bottom pixel (x, y+1)
      if (y + 1 < height) {
        const bottomIdx = ((y + 1) * width + x) * 4;
        data[bottomIdx] = clamp(data[bottomIdx] + errR * 5 / 16);
        data[bottomIdx + 1] = clamp(data[bottomIdx + 1] + errG * 5 / 16);
        data[bottomIdx + 2] = clamp(data[bottomIdx + 2] + errB * 5 / 16);
      }

      // Bottom-right pixel (x+1, y+1)
      if (x + 1 < width && y + 1 < height) {
        const brIdx = ((y + 1) * width + (x + 1)) * 4;
        data[brIdx] = clamp(data[brIdx] + errR * 1 / 16);
        data[brIdx + 1] = clamp(data[brIdx + 1] + errG * 1 / 16);
        data[brIdx + 2] = clamp(data[brIdx + 2] + errB * 1 / 16);
      }
    }
  }

  return new ImageData(data, width, height);
}

function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function findNearestColor(color: RGB, palette: RGB[]): RGB {
  let minDist = Infinity;
  let nearest = palette[0];

  palette.forEach(paletteColor => {
    const dist = colorDistance(color, paletteColor);
    if (dist < minDist) {
      minDist = dist;
      nearest = paletteColor;
    }
  });

  return nearest;
}

function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
