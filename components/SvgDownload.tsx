'use client';

import { PixelGrid } from '@/lib/pixelate';
import { generateSvg, downloadSvg } from '@/lib/exportSvg';

interface SvgDownloadProps {
  pixelGrid: PixelGrid;
  selectedColors?: string[];
  disabled?: boolean;
  groupByColor?: boolean;
  onGroupByColorChange?: (grouped: boolean) => void;
}

export default function SvgDownload({ 
  pixelGrid, 
  selectedColors, 
  disabled, 
  groupByColor = false,
  onGroupByColorChange 
}: SvgDownloadProps) {
  const handleDownload = () => {
    const svg = generateSvg({
      pixelGrid,
      selectedColors: selectedColors && selectedColors.length > 0 ? selectedColors : undefined,
      pixelSize: 10,
      groupByColor,
    });
    downloadSvg(svg, 'pixel-art.svg');
  };

  return (
    <div className="flex flex-col gap-3">
      {onGroupByColorChange && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={groupByColor}
            onChange={e => onGroupByColorChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4"
          />
          <span className="text-sm">Group by color (separate layers)</span>
        </label>
      )}
      
      <button
        onClick={handleDownload}
        disabled={disabled}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Download SVG
      </button>
    </div>
  );
}
