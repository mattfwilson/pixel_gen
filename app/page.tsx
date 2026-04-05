'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import PixelPreview from '@/components/PixelPreview';
import ColorFilter from '@/components/ColorFilter';
import FigmaExport from '@/components/FigmaExport';
import { pixelateImage, PixelGrid } from '@/lib/pixelate';
import { exportToFigma } from '@/lib/figma';

export default function Home() {
  const [pixelGrid, setPixelGrid] = useState<PixelGrid | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [pixelSize, setPixelSize] = useState(10);
  const [processing, setProcessing] = useState(false);

  const handleImageSelect = async (file: File) => {
    setProcessing(true);
    try {
      const grid = await pixelateImage(file, {
        pixelSize,
        maxDimension: 100,
      });
      setPixelGrid(grid);
      setSelectedColors(grid.uniqueColors); // Select all colors by default
    } catch (error) {
      console.error('Failed to process image:', error);
      alert('Failed to process image. Please try another file.');
    } finally {
      setProcessing(false);
    }
  };

  const handleColorToggle = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const handleSelectAll = () => {
    if (pixelGrid) {
      setSelectedColors(pixelGrid.uniqueColors);
    }
  };

  const handleDeselectAll = () => {
    setSelectedColors([]);
  };

  const handleExport = async (accessToken: string, fileKey: string) => {
    if (!pixelGrid) {
      throw new Error('No pixel grid to export');
    }

    const result = await exportToFigma({
      accessToken,
      fileKey,
      pixelGrid,
      selectedColors: selectedColors.length > 0 ? selectedColors : undefined,
    });

    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pixel Gen
          </h1>
          <p className="text-gray-600">
            Convert images to Figma-ready pixel art vectors
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Upload and Controls */}
          <div className="flex flex-col gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <ImageUpload
                onImageSelect={handleImageSelect}
                disabled={processing}
              />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <label htmlFor="pixelSize" className="block text-sm font-medium mb-2">
                Pixel Scale: {pixelSize}x
              </label>
              <input
                id="pixelSize"
                type="range"
                min="1"
                max="50"
                value={pixelSize}
                onChange={e => setPixelSize(Number(e.target.value))}
                disabled={processing}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-2">
                Higher values = coarser pixelation (fewer shapes)
              </p>
            </div>

            {pixelGrid && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <ColorFilter
                  colors={pixelGrid.uniqueColors}
                  selectedColors={selectedColors}
                  onColorToggle={handleColorToggle}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                />
              </div>
            )}
          </div>

          {/* Right Column: Preview and Export */}
          <div className="flex flex-col gap-8">
            {pixelGrid && (
              <>
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <PixelPreview
                    pixelGrid={pixelGrid}
                    selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                  />
                </div>

                <FigmaExport
                  onExport={handleExport}
                  disabled={processing || selectedColors.length === 0}
                />
              </>
            )}

            {!pixelGrid && !processing && (
              <div className="bg-white p-12 rounded-lg shadow-md flex items-center justify-center text-gray-400">
                Upload an image to get started
              </div>
            )}

            {processing && (
              <div className="bg-white p-12 rounded-lg shadow-md flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Processing image...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
