'use client';

import { PixelGrid } from '@/lib/pixelate';
import { useEffect, useRef, useState } from 'react';

interface PixelPreviewProps {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
  originalImage?: string;
}

/**
 * Compute the preview block size (px per pixel grid cell) so the canvas
 * never exceeds ~600px on its longest side. Small grids get large blocks
 * so individual pixels are visible; large grids get 1px blocks (1:1).
 *
 *   grid 2×2   → 300px blocks → 600×600 canvas
 *   grid 64×64 →   9px blocks → 576×576 canvas
 *   grid 500×500→  1px block  → 500×500 canvas
 */
function previewBlockSize(gridW: number, gridH: number): number {
  return Math.max(1, Math.floor(600 / Math.max(gridW, gridH)));
}

/**
 * Parse '#rrggbb' into [r, g, b] without string allocation per pixel.
 * Uses a pre-computed lookup for the two hex digits.
 */
function hexToRgbFast(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

export default function PixelPreview({ pixelGrid, selectedColors, originalImage }: PixelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGrid, setShowGrid]           = useState(false);
  const [zoom, setZoom]                   = useState(1);
  const [showComparison, setShowComparison] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height, pixels } = pixelGrid;
    const blockPx = previewBlockSize(width, height);

    const canvasW = width  * blockPx;
    const canvasH = height * blockPx;

    canvas.width  = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

    // ── Build pixel buffer in one pass ──────────────────────────────────────
    // Writing directly into a Uint8ClampedArray avoids N fillStyle assignments
    // and N GPU draw calls — all pixels are flushed in a single putImageData.
    const buf = new Uint8ClampedArray(canvasW * canvasH * 4); // zeroed = transparent

    const colorFilter = selectedColors ? new Set(selectedColors) : null;

    for (const pixel of pixels) {
      if (colorFilter && !colorFilter.has(pixel.color)) continue;

      const [r, g, b] = hexToRgbFast(pixel.color);

      // Fill the blockPx × blockPx block for this pixel
      const baseX = pixel.x * blockPx;
      const baseY = pixel.y * blockPx;

      for (let dy = 0; dy < blockPx; dy++) {
        const rowStart = ((baseY + dy) * canvasW + baseX) * 4;
        for (let dx = 0; dx < blockPx; dx++) {
          const i = rowStart + dx * 4;
          buf[i]     = r;
          buf[i + 1] = g;
          buf[i + 2] = b;
          buf[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(new ImageData(buf, canvasW, canvasH), 0, 0);

    // ── Grid overlay (drawn on top via strokeRect) ───────────────────────────
    if (showGrid && blockPx > 1) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth   = 1;

      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * blockPx, 0);
        ctx.lineTo(x * blockPx, canvasH);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * blockPx);
        ctx.lineTo(canvasW, y * blockPx);
        ctx.stroke();
      }
    }
  }, [pixelGrid, selectedColors, showGrid]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base md:text-lg font-semibold">Preview</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Grid
          </button>
          {originalImage && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showComparison ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Compare
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">Zoom:</label>
        <input
          type="range"
          min="1"
          max="4"
          step="0.5"
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-32"
        />
        <span className="text-sm text-gray-600">{zoom}×</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {showComparison && originalImage && (
          <div className="border border-gray-300 rounded-lg p-3 md:p-4 bg-gray-50 flex-1 overflow-auto">
            <p className="text-xs text-gray-600 mb-2 text-center">Original</p>
            <div className="overflow-auto" style={{ maxHeight: '500px' }}>
              <img
                src={originalImage}
                alt="Original"
                className="max-w-full h-auto"
                style={{
                  imageRendering: 'auto',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>
        )}

        <div className={`border border-gray-300 rounded-lg p-3 md:p-4 bg-gray-50 ${showComparison ? 'flex-1' : 'inline-block'}`}>
          {showComparison && <p className="text-xs text-gray-600 mb-2 text-center">Pixelated</p>}
          <div className="overflow-auto" style={{ maxHeight: showComparison ? '500px' : '700px' }}>
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto"
              style={{
                imageRendering: 'pixelated',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        {pixelGrid.width} × {pixelGrid.height} pixels ({pixelGrid.pixels.length} shapes)
      </p>
    </div>
  );
}
