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
  pixelSize: number; // scale factor (e.g., 10 = each pixel is 10x10 input pixels)
  maxDimension: number; // max width or height in output pixels (default 100)
}

/**
 * Pixelate an image file by sampling colors at regular intervals
 */
export async function pixelateImage(
  file: File,
  options: PixelateOptions
): Promise<PixelGrid> {
  const { pixelSize, maxDimension } = options;

  // Load image
  const img = await loadImage(file);
  
  // Calculate output dimensions (capped at maxDimension)
  const inputWidth = img.width;
  const inputHeight = img.height;
  
  let outputWidth = Math.floor(inputWidth / pixelSize);
  let outputHeight = Math.floor(inputHeight / pixelSize);
  
  // Cap dimensions
  if (outputWidth > maxDimension || outputHeight > maxDimension) {
    const scale = Math.min(maxDimension / outputWidth, maxDimension / outputHeight);
    outputWidth = Math.floor(outputWidth * scale);
    outputHeight = Math.floor(outputHeight * scale);
  }
  
  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = inputWidth;
  canvas.height = inputHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
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
  
  return {
    pixels,
    width: outputWidth,
    height: outputHeight,
    uniqueColors: Array.from(colorSet).sort(),
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
