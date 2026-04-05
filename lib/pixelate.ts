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
  maxDimension?: number; // max width or height in output pixels (default 100)
  exactWidth?: number; // exact output width (takes priority over pixelSize)
  exactHeight?: number; // exact output height (takes priority over pixelSize)
  paletteSize?: number; // limit colors to N using k-means clustering (optional)
  colorPreset?: string[]; // snap colors to specific palette (optional)
  useDithering?: boolean; // apply Floyd-Steinberg dithering when reducing colors (optional)
}

/**
 * Pixelate an image file by sampling colors at regular intervals
 */
import { quantizeColors } from './colorQuantize';
import { snapToNearestColor } from './colorPresets';
import { applyDithering } from './dithering';

export async function pixelateImage(
  file: File,
  options: PixelateOptions
): Promise<PixelGrid> {
  const { pixelSize, maxDimension, exactWidth, exactHeight, paletteSize, colorPreset, useDithering } = options;

  // Load image
  const img = await loadImage(file);
  
  // Calculate output dimensions
  const inputWidth = img.width;
  const inputHeight = img.height;
  
  let outputWidth: number;
  let outputHeight: number;
  
  if (exactWidth && exactHeight) {
    // Use exact dimensions
    outputWidth = exactWidth;
    outputHeight = exactHeight;
  } else if (pixelSize) {
    // Use pixel scale
    outputWidth = Math.floor(inputWidth / pixelSize);
    outputHeight = Math.floor(inputHeight / pixelSize);
    
    // Cap dimensions if maxDimension is specified
    if (maxDimension && (outputWidth > maxDimension || outputHeight > maxDimension)) {
      const scale = Math.min(maxDimension / outputWidth, maxDimension / outputHeight);
      outputWidth = Math.floor(outputWidth * scale);
      outputHeight = Math.floor(outputHeight * scale);
    }
  } else {
    throw new Error('Either pixelSize or exactWidth/exactHeight must be provided');
  }
  
  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = inputWidth;
  canvas.height = inputHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  // Apply dithering if requested and we have a color palette
  if (useDithering && (colorPreset || paletteSize)) {
    const fullImageData = ctx.getImageData(0, 0, inputWidth, inputHeight);
    
    // Get target palette
    let targetPalette: string[] = [];
    if (colorPreset && colorPreset.length > 0) {
      targetPalette = colorPreset;
    } else if (paletteSize) {
      // Need to do a preliminary color extraction to get palette for dithering
      const tempColorSet = new Set<string>();
      for (let y = 0; y < inputHeight; y += 10) {
        for (let x = 0; x < inputWidth; x += 10) {
          const data = ctx.getImageData(x, y, 1, 1).data;
          if (data[3] > 0) {
            tempColorSet.add(rgbToHex(data[0], data[1], data[2]));
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
      ctx.putImageData(dithered, 0, 0);
    }
  }
  
  // Sample pixels
  const pixels: Pixel[] = [];
  const colorSet = new Set<string>();
  
  const sampleStepX = inputWidth / outputWidth;
  const sampleStepY = inputHeight / outputHeight;
  
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const sampleX = Math.floor(x * sampleStepX);
      const sampleY = Math.floor(y * sampleStepY);
      
      const imageData = ctx.getImageData(sampleX, sampleY, 1, 1);
      const [r, g, b, a] = imageData.data;
      
      // Skip fully transparent pixels
      if (a === 0) continue;
      
      const color = rgbToHex(r, g, b);
      colorSet.add(color);
      
      pixels.push({ x, y, color });
    }
  }
  
  let uniqueColors = Array.from(colorSet).sort();
  let finalPixels = pixels;
  
  // Apply color preset snapping first (takes priority over quantization)
  if (colorPreset && colorPreset.length > 0) {
    console.log(`Snapping colors to preset (${colorPreset.length} colors)...`);
    finalPixels = pixels.map(pixel => ({
      ...pixel,
      color: snapToNearestColor(pixel.color, colorPreset),
    }));
    
    // Update unique colors
    const presetColorSet = new Set(finalPixels.map(p => p.color));
    uniqueColors = Array.from(presetColorSet).sort();
  }
  // Apply color quantization if requested (and no preset)
  else if (paletteSize && uniqueColors.length > paletteSize) {
    console.log(`Quantizing ${uniqueColors.length} colors to ${paletteSize}...`);
    const colorMap = quantizeColors(uniqueColors, paletteSize);
    
    // Remap pixel colors
    finalPixels = pixels.map(pixel => ({
      ...pixel,
      color: colorMap.get(pixel.color) || pixel.color,
    }));
    
    // Update unique colors
    const quantizedColorSet = new Set(finalPixels.map(p => p.color));
    uniqueColors = Array.from(quantizedColorSet).sort();
  }
  
  console.log('Pixelation complete:', {
    outputWidth,
    outputHeight,
    totalPixels: finalPixels.length,
    uniqueColorCount: uniqueColors.length,
    sampleColors: uniqueColors.slice(0, 10), // First 10 colors for debugging
  });
  
  return {
    pixels: finalPixels,
    width: outputWidth,
    height: outputHeight,
    uniqueColors,
  };
}

/**
 * Load an image file and return HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
