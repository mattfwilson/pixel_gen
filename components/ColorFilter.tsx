'use client';

interface ColorFilterProps {
  colors: string[];
  selectedColors: string[];
  onColorToggle: (color: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function ColorFilter({
  colors,
  selectedColors,
  onColorToggle,
  onSelectAll,
  onDeselectAll,
}: ColorFilterProps) {
  if (colors.length === 0) return null;
  
  // Debug: log colors to console
  console.log('ColorFilter rendering with colors:', colors.slice(0, 10));

  // Calculate grid columns and swatch size based on color count
  const getGridConfig = () => {
    if (colors.length <= 8) return { cols: 4, size: 'w-8 h-8', minSize: '32px' };
    if (colors.length <= 16) return { cols: 6, size: 'w-6 h-6', minSize: '24px' };
    if (colors.length <= 32) return { cols: 8, size: 'w-5 h-5', minSize: '20px' };
    return { cols: 10, size: 'w-4 h-4', minSize: '16px' };
  };

  const { cols, size, minSize } = getGridConfig();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base md:text-lg font-semibold">Color Filter</h3>
      
      <div className="flex gap-2">
        <button
          onClick={onSelectAll}
          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
        >
          Select All
        </button>
        <button
          onClick={onDeselectAll}
          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
        >
          Deselect All
        </button>
      </div>
      
      <p className="text-sm text-gray-600">
        {selectedColors.length} of {colors.length} colors selected
      </p>

      <div 
        className={`grid gap-2 max-h-64 overflow-y-auto p-2 border border-gray-300 rounded-lg bg-white`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {colors.map(color => {
          const isSelected = selectedColors.includes(color);
          
          const handleCopyHex = (e: React.MouseEvent) => {
            e.stopPropagation();
            navigator.clipboard.writeText(color);
            // Could add a toast notification here
          };
          
          return (
            <div
              key={color}
              className="relative group"
            >
              <button
                onClick={() => onColorToggle(color)}
                onDoubleClick={handleCopyHex}
                className={`
                  ${size} rounded border-2 transition-all
                  ${isSelected ? 'border-blue-600 scale-110 shadow-lg' : 'border-gray-300'}
                  hover:scale-110
                `}
                style={{ 
                  backgroundColor: color,
                  minWidth: minSize,
                  minHeight: minSize,
                }}
                title={`${color} ${isSelected ? '(selected)' : ''} - Double-click to copy`}
                aria-label={`Color ${color}`}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 italic">
        Double-click a color to copy its hex code
      </p>
    </div>
  );
}
