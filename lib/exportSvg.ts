import { PixelGrid } from './pixelate';

export interface SvgExportOptions {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
  pixelSize?: number; // Size of each pixel square in SVG (default: 10)
  includeTransparent?: boolean; // Include transparent pixels as shapes (default: false)
  groupByColor?: boolean; // Group shapes by color in separate layers (default: false)
}

/**
 * Generate SVG string from pixel grid
 */
export function generateSvg(options: SvgExportOptions): string {
  const {
    pixelGrid,
    selectedColors,
    pixelSize = 10,
    includeTransparent = false,
    groupByColor = false,
  } = options;

  const width = pixelGrid.width * pixelSize;
  const height = pixelGrid.height * pixelSize;

  // Filter pixels by selected colors
  const pixels = selectedColors
    ? pixelGrid.pixels.filter(p => selectedColors.includes(p.color))
    : pixelGrid.pixels;

  let content: string;

  if (groupByColor) {
    // Group pixels by color
    const colorGroups = new Map<string, typeof pixels>();
    pixels.forEach(pixel => {
      if (!colorGroups.has(pixel.color)) {
        colorGroups.set(pixel.color, []);
      }
      colorGroups.get(pixel.color)!.push(pixel);
    });

    // Generate grouped content
    const groups = Array.from(colorGroups.entries()).map(([color, colorPixels]) => {
      const rects = colorPixels.map(pixel => {
        const x = pixel.x * pixelSize;
        const y = pixel.y * pixelSize;
        return `    <rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="${color}"/>`;
      }).join('\n');
      
      return `  <g id="color-${color.replace('#', '')}" data-color="${color}">
${rects}
  </g>`;
    }).join('\n');

    content = groups;
  } else {
    // Generate flat rect elements
    const rects = pixels.map(pixel => {
      const x = pixel.x * pixelSize;
      const y = pixel.y * pixelSize;
      return `  <rect x="${x}" y="${y}" width="${pixelSize}" height="${pixelSize}" fill="${pixel.color}"/>`;
    }).join('\n');

    content = rects;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${content}
</svg>`;
}

/**
 * Download SVG file
 */
export function downloadSvg(svg: string, filename: string = 'pixel-art.svg') {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
