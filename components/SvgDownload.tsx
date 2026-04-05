'use client';

import { PixelGrid } from '@/lib/pixelate';
import { generateSvg, downloadSvg } from '@/lib/exportSvg';

interface SvgDownloadProps {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
  disabled?: boolean;
}

export default function SvgDownload({ pixelGrid, selectedColors, disabled }: SvgDownloadProps) {
  const handleDownload = () => {
    const svg = generateSvg({
      pixelGrid,
      selectedColors: selectedColors && selectedColors.length > 0 ? selectedColors : undefined,
      pixelSize: 10,
    });
    downloadSvg(svg, 'pixel-art.svg');
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
    >
      Download SVG
    </button>
  );
}
