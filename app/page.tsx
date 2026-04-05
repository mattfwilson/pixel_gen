'use client';

import { useState, useEffect, useRef } from 'react';
import ImageUpload from '@/components/ImageUpload';
import SampleImages from '@/components/SampleImages';
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
  const [sizeMode, setSizeMode] = useState<'scale' | 'exact'>('scale');
  const [exactWidth, setExactWidth] = useState(32);
  const [exactHeight, setExactHeight] = useState(32);
  const [useDithering, setUseDithering] = useState(false);
  const [groupByColor, setGroupByColor] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const processImage = async (
    file: File, 
    newPixelSize: number, 
    newPaletteSize: number, 
    preset: string,
    mode: 'scale' | 'exact' = 'scale',
    width?: number,
    height?: number
  ) => {
    setProcessing(true);
    try {
      const presetColors = COLOR_PRESETS.find(p => p.name === preset)?.colors || [];
      const grid = await pixelateImage(file, {
        ...(mode === 'exact' && width && height 
          ? { exactWidth: width, exactHeight: height }
          : { pixelSize: newPixelSize, maxDimension: 100 }
        ),
        paletteSize: presetColors.length > 0 ? undefined : newPaletteSize, // Disable quantization when using preset
        colorPreset: presetColors.length > 0 ? presetColors : undefined,
        useDithering,
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

  const debouncedProcessImage = (
    file: File, 
    newPixelSize: number, 
    newPaletteSize: number, 
    preset: string,
    mode: 'scale' | 'exact' = 'scale',
    width?: number,
    height?: number
  ) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      processImage(file, newPixelSize, newPaletteSize, preset, mode, width, height);
    }, 300); // 300ms debounce
  };

  const handleImageSelect = async (file: File) => {
    setUploadedFile(file);
    
    // Create data URL for original image comparison
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImageUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    await processImage(file, pixelSize, paletteSize, selectedPreset, sizeMode, exactWidth, exactHeight);
  };

  const handleSampleSelect = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], 'sample.svg', { type: 'image/svg+xml' });
      handleImageSelect(file);
    } catch (error) {
      console.error('Failed to load sample:', error);
    }
  };

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleImageSelect(file);
          break;
        }
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!uploadedFile) return;

      // Arrow keys to adjust pixel scale
      if (sizeMode === 'scale' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handlePixelSizeChange(Math.min(50, pixelSize + 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handlePixelSizeChange(Math.max(1, pixelSize - 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste as any);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste as any);
    };
  }, [uploadedFile, pixelSize, sizeMode]);


  const handleDitheringChange = (enabled: boolean) => {
    setUseDithering(enabled);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, pixelSize, paletteSize, selectedPreset, sizeMode, exactWidth, exactHeight);
    }
  };

  const handlePixelSizeChange = (newSize: number) => {
    setPixelSize(newSize);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, newSize, paletteSize, selectedPreset, sizeMode, exactWidth, exactHeight);
    }
  };

  const handlePaletteSizeChange = (newSize: number) => {
    setPaletteSize(newSize);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, pixelSize, newSize, selectedPreset, sizeMode, exactWidth, exactHeight);
    }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, pixelSize, paletteSize, preset, sizeMode, exactWidth, exactHeight);
    }
  };

  const handleSizeModeChange = (mode: 'scale' | 'exact') => {
    setSizeMode(mode);
    if (uploadedFile) {
      debouncedProcessImage(uploadedFile, pixelSize, paletteSize, selectedPreset, mode, exactWidth, exactHeight);
    }
  };

  const handleExactSizeChange = (width: number, height: number) => {
    setExactWidth(width);
    setExactHeight(height);
    if (uploadedFile && sizeMode === 'exact') {
      debouncedProcessImage(uploadedFile, pixelSize, paletteSize, selectedPreset, 'exact', width, height);
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
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Pixel Gen
              </h1>
              <p className="text-gray-600">
                Convert images to Figma-ready pixel art vectors
              </p>
            </div>
            <button
              onClick={() => {
                const shortcuts = `Keyboard Shortcuts:
• Arrow Up/Down: Adjust pixel scale
• Cmd/Ctrl + V: Paste image from clipboard

Tips:
• Drag & drop images anywhere
• Double-click color swatches to copy hex
• Use presets for retro game art styles`;
                alert(shortcuts);
              }}
              className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              title="Keyboard shortcuts"
            >
              ⌨️ Shortcuts
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Upload and Preview - 75% width */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            {/* Combined Upload and Preview Container */}
            <div className="bg-white p-4 rounded-lg shadow-md flex flex-col gap-4">
              {/* Upload section - always visible */}
              <div className="flex flex-col gap-3">
                <ImageUpload
                  onImageSelect={handleImageSelect}
                  disabled={processing}
                />
                <SampleImages
                  onSampleSelect={handleSampleSelect}
                  disabled={processing}
                />
              </div>

              {/* Preview section - appears when image is loaded */}
              {pixelGrid && (
                <div className="pt-4 border-t border-gray-200">
                  <PixelPreview
                    pixelGrid={pixelGrid}
                    selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                    originalImage={originalImageUrl || undefined}
                  />
                </div>
              )}
            </div>

            {/* Processing state */}
            {processing && (
              <div className="bg-white p-12 rounded-lg shadow-md flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Processing image...</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Controls and Export - 25% width */}
          <div className="lg:col-span-1 flex flex-col gap-8">

            <div className="bg-white p-6 rounded-lg shadow-md flex flex-col gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Size Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSizeModeChange('scale')}
                    disabled={processing || !uploadedFile}
                    className={`flex-1 px-4 py-2 rounded transition-colors ${
                      sizeMode === 'scale'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Scale
                  </button>
                  <button
                    onClick={() => handleSizeModeChange('exact')}
                    disabled={processing || !uploadedFile}
                    className={`flex-1 px-4 py-2 rounded transition-colors ${
                      sizeMode === 'exact'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Exact Size
                  </button>
                </div>
              </div>

              {sizeMode === 'scale' ? (
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
              ) : (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label htmlFor="exactWidth" className="block text-sm font-medium mb-2">
                      Width
                    </label>
                    <input
                      id="exactWidth"
                      type="number"
                      min="1"
                      max="200"
                      value={exactWidth}
                      onChange={e => handleExactSizeChange(Number(e.target.value), exactHeight)}
                      disabled={processing || !uploadedFile}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="exactHeight" className="block text-sm font-medium mb-2">
                      Height
                    </label>
                    <input
                      id="exactHeight"
                      type="number"
                      min="1"
                      max="200"
                      value={exactHeight}
                      onChange={e => handleExactSizeChange(exactWidth, Number(e.target.value))}
                      disabled={processing || !uploadedFile}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="colorPreset" className="block text-sm font-medium mb-2">
                  Color Preset
                </label>
                <select
                  id="colorPreset"
                  value={selectedPreset}
                  onChange={e => handlePresetChange(e.target.value)}
                  disabled={processing || !uploadedFile}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
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

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDithering}
                    onChange={e => handleDitheringChange(e.target.checked)}
                    disabled={processing || !uploadedFile || (selectedPreset === 'None' && paletteSize >= 64)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Enable Dithering</span>
                </label>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  Floyd-Steinberg dithering for smoother color transitions
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

            {/* Export section - appears when image is loaded */}
            {pixelGrid && (
              <div className="bg-white p-6 rounded-lg shadow-md flex flex-col gap-4">
                <h3 className="text-lg font-semibold">Export</h3>
                
                <SvgDownload
                  pixelGrid={pixelGrid}
                  selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
                  disabled={processing || selectedColors.length === 0}
                  groupByColor={groupByColor}
                  onGroupByColorChange={setGroupByColor}
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
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
