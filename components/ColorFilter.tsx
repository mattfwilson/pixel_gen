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

      <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-300 rounded-lg">
        {colors.map(color => {
          const isSelected = selectedColors.includes(color);
          return (
            <button
              key={color}
              onClick={() => onColorToggle(color)}
              className={`
                w-12 h-12 rounded border-2 transition-all
                ${isSelected ? 'border-blue-600 scale-110' : 'border-gray-300'}
                hover:scale-110
              `}
              style={{ backgroundColor: color }}
              title={color}
            />
          );
        })}
      </div>
    </div>
  );
}
