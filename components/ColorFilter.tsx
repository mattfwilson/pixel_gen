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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Color Filter</h3>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-600">
        {selectedColors.length} of {colors.length} colors selected
      </p>

      <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-300 rounded-lg bg-white">
        {colors.map(color => {
          const isSelected = selectedColors.includes(color);
          return (
            <div
              key={color}
              className="relative"
            >
              <button
                onClick={() => onColorToggle(color)}
                className={`
                  w-12 h-12 rounded border-2 transition-all
                  ${isSelected ? 'border-blue-600 scale-110 shadow-lg' : 'border-gray-300'}
                  hover:scale-110
                `}
                style={{ 
                  backgroundColor: color,
                  minWidth: '48px',
                  minHeight: '48px',
                }}
                title={`${color} ${isSelected ? '(selected)' : ''}`}
                aria-label={`Color ${color}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
