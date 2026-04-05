'use client';

import { PixelGrid } from '@/lib/pixelate';
import { useEffect, useRef, useState } from 'react';

interface PixelPreviewProps {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
  originalImage?: string; // Data URL of original image
}

export default function PixelPreview({ pixelGrid, selectedColors, originalImage }: PixelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const pixelSize = 10; // 10px per pixel for preview

    canvas.width = pixelGrid.width * pixelSize;
    canvas.height = pixelGrid.height * pixelSize;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw pixels
    pixelGrid.pixels.forEach(pixel => {
      // Skip if color filtering is active and this color isn't selected
      if (selectedColors && !selectedColors.includes(pixel.color)) {
        return;
      }

      ctx.fillStyle = pixel.color;
      ctx.fillRect(
        pixel.x * pixelSize,
        pixel.y * pixelSize,
        pixelSize,
        pixelSize
      );
    });

    // Draw grid overlay if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= pixelGrid.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * pixelSize, 0);
        ctx.lineTo(x * pixelSize, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= pixelGrid.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * pixelSize);
        ctx.lineTo(canvas.width, y * pixelSize);
        ctx.stroke();
      }
    }
  }, [pixelGrid, selectedColors, showGrid]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Preview</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showGrid ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Grid
          </button>
          {originalImage && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
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

      <div className="flex gap-4">
        {showComparison && originalImage && (
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 flex-1 overflow-auto">
            <p className="text-xs text-gray-600 mb-2 text-center">Original</p>
            <div className="overflow-auto max-h-[600px]">
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
        
        <div className={`border border-gray-300 rounded-lg p-4 bg-gray-50 ${showComparison ? 'flex-1' : 'inline-block'}`}>
          {showComparison && <p className="text-xs text-gray-600 mb-2 text-center">Pixelated</p>}
          <div className="overflow-auto" style={{ maxHeight: showComparison ? '600px' : '800px' }}>
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
