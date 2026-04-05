'use client';

import { PixelGrid } from '@/lib/pixelate';
import { useEffect, useRef } from 'react';

interface PixelPreviewProps {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
}

export default function PixelPreview({ pixelGrid, selectedColors }: PixelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  }, [pixelGrid, selectedColors]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Preview</h3>
      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 inline-block">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <p className="text-sm text-gray-600">
        {pixelGrid.width} × {pixelGrid.height} pixels ({pixelGrid.pixels.length} shapes)
      </p>
    </div>
  );
}
