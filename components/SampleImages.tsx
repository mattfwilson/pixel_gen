'use client';

interface SampleImagesProps {
  onSampleSelect: (url: string) => void;
  disabled?: boolean;
}

const SAMPLES = [
  { name: 'Smiley', url: '/samples/smiley.svg' },
];

export default function SampleImages({ onSampleSelect, disabled }: SampleImagesProps) {
  const handleSampleClick = async (url: string) => {
    onSampleSelect(url);
  };

  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-medium text-gray-700">Sample:</p>
      <div className="flex gap-2">
        {SAMPLES.map(sample => (
          <button
            key={sample.url}
            onClick={() => handleSampleClick(sample.url)}
            disabled={disabled}
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded transition-colors"
          >
            {sample.name}
          </button>
        ))}
      </div>
    </div>
  );
}
