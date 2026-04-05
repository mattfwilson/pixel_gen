import { PixelGrid } from './pixelate';

export interface FigmaExportOptions {
  accessToken: string;
  fileKey: string;
  pixelGrid: PixelGrid;
  selectedColors?: string[]; // if provided, only export these colors
  frameName?: string;
}

interface FigmaNode {
  type: string;
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Array<{ type: string; color: { r: number; g: number; b: number } }>;
  children?: FigmaNode[];
}

/**
 * Export pixel grid to Figma as vector rectangles
 */
export async function exportToFigma(
  options: FigmaExportOptions
): Promise<{ success: boolean; nodeId?: string; error?: string }> {
  const {
    accessToken,
    fileKey,
    pixelGrid,
    selectedColors,
    frameName = 'Pixel Art',
  } = options;

  // Filter pixels by selected colors if provided
  const pixels = selectedColors
    ? pixelGrid.pixels.filter(p => selectedColors.includes(p.color))
    : pixelGrid.pixels;

  if (pixels.length === 0) {
    return { success: false, error: 'No pixels to export' };
  }

  // Build Figma node tree
  const rectangles: FigmaNode[] = pixels.map(pixel => ({
    type: 'RECTANGLE',
    name: `Pixel ${pixel.x},${pixel.y}`,
    x: pixel.x * 10, // 10px per pixel in Figma
    y: pixel.y * 10,
    width: 10,
    height: 10,
    fills: [
      {
        type: 'SOLID',
        color: hexToRgb01(pixel.color),
      },
    ],
  }));

  const frame: FigmaNode = {
    type: 'FRAME',
    name: frameName,
    x: 0,
    y: 0,
    width: pixelGrid.width * 10,
    height: pixelGrid.height * 10,
    children: rectangles,
  };

  // Call Figma API to create nodes
  try {
    const response = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes`,
      {
        method: 'POST',
        headers: {
          'X-Figma-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodes: [frame],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Figma API error: ${error}` };
    }

    const data = await response.json();
    return { success: true, nodeId: data.nodes?.[0]?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert hex color to Figma RGB format (0-1 range)
 */
function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}
