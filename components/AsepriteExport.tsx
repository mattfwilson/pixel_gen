'use client';

import { PixelGrid } from '@/lib/pixelate';
import { generateAsepriteFile, downloadAseprite } from '@/lib/exportAseprite';

interface AsepriteExportProps {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
  disabled?: boolean;
}

export default function AsepriteExport({
  pixelGrid,
  selectedColors,
  disabled,
}: AsepriteExportProps) {
  const handleDownload = () => {
    try {
      const fileBuffer = generateAsepriteFile(
        pixelGrid,
        selectedColors && selectedColors.length > 0 ? selectedColors : undefined
      );
      downloadAseprite(fileBuffer, 'pixel-art.aseprite');
    } catch (err) {
      console.error('Aseprite export failed:', err);
      alert('Failed to export .aseprite file. Please try again.');
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
    >
      Download .aseprite
    </button>
  );
}
