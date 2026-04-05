'use client';

import { useState, useEffect, useRef } from 'react';
import ImageUpload from '@/components/ImageUpload';
import PixelPreview from '@/components/PixelPreview';
import ColorFilter from '@/components/ColorFilter';
import FigmaExport from '@/components/FigmaExport';
import SvgDownload from '@/components/SvgDownload';
import { pixelateImage, PixelGrid } from '@/lib/pixelate';
import { exportToFigma } from '@/lib/figma';
import { COLOR_PRESETS } from '@/lib/colorPresets';

export default function Home() {
  const [pixelGrid, setPixelGrid] = useState<PixelGrid | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [pixelSize, setPixelSize] = useState(10);
  const [paletteSize, setPaletteSize] = useState(16);
  const [selectedPreset, setSelectedPreset] = useState('None');
  const [processing, setProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const processImage = async (file: File, newPixelSize: number, newPaletteSize: number, preset: string) => {
    setProcessing(true);
    try {
      const presetColors = COLOR_PRESETS.find(p => p.name === preset)?.colors || [];
      const grid = await pixelateImage(file, {
        pixelSize: newPixelSize,
        maxDimension: 100,
        paletteSize: presetColors.length > 0 ? undefined : newPaletteSize, // Disable quantization when using preset
        colorPreset: presetColors.length > 0 ? presetColors : undefined,
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

  const debouncedProcessImage = (file: File, newPixelSize: number, newPaletteSize: number, preset: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      processImage(file, newPixelSize, newPaletteSize, preset);
    }, 300); // 300ms debounce
  };

  const handleImageSelect = async (file: File) => {
    setUploadedFile(file);
    await processImage(file, pixelSize, paletteSize, selectedPreset);
  };

  const handlePixelSizeChange = (newSize: number) => {
    setPixelSize(newSize);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, newSize, paletteSize, selectedPreset);
    }
  };

  const handlePaletteSizeChange = (newSize: number) => {
    setPaletteSize(newSize);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, pixelSize, newSize, selectedPreset);
    }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, pixelSize, paletteSize, preset);
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

            <div className="bg-white p-6 rounded-lg shadow-md flex flex-col gap-6">
              <div>
                <label htmlFor="pixelSize" className="block text-sm font-medium mb-2">
                  Pixel Scale: {pixelSize}x
                </label>
                <input
                  id="pixelSize"
                  type="range"
                  min="1"
                  max="50"
                  value={pixelSize}
                  onChange={e => handlePixelSizeChange(Number(e.target.value))}
                  disabled={processing || !uploadedFile}
                  className="w-full"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Higher values = coarser pixelation (fewer shapes)
                </p>
              </div>

              <div>
                <label htmlFor="colorPreset" className="block text-sm font-medium mb-2">
                  Color Preset
                </label>
                <select
                  id="colorPreset"
                  value={selectedPreset}
                  onChange={e => handlePresetChange(e.target.value)}
                  disabled={processing || !uploadedFile}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  {COLOR_PRESETS.map(preset => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name} {preset.description && `— ${preset.description}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-2">
                  Snap colors to retro palettes
                </p>
              </div>

              <div>
                <label htmlFor="paletteSize" className="block text-sm font-medium mb-2">
                  Max Colors: {paletteSize}
                  {selectedPreset !== 'None' && <span className="text-xs text-gray-500 ml-2">(disabled - using preset)</span>}
                </label>
                <input
                  id="paletteSize"
                  type="range"
                  min="2"
                  max="64"
                  value={paletteSize}
                  onChange={e => handlePaletteSizeChange(Number(e.target.value))}
                  disabled={processing || !uploadedFile || selectedPreset !== 'None'}
                  className="w-full"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Limits color palette using k-means clustering
                </p>
              </div>
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

                <div className="bg-white p-6 rounded-lg shadow-md flex flex-col gap-4">
                  <h3 className="text-lg font-semibold">Export</h3>
                  
                  <SvgDownload
                    pixelGrid={pixelGrid}
                    selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                    disabled={processing || selectedColors.length === 0}
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>

                  <FigmaExport
                    onExport={handleExport}
                    disabled={processing || selectedColors.length === 0}
                  />
                </div>
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
