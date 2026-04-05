export interface ColorPreset {
  name: string;
  colors: string[];
  description: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'None',
    colors: [],
    description: 'Use original colors',
  },
  {
    name: 'Gameboy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    description: 'Classic 4-shade green',
  },
  {
    name: 'CGA',
    colors: ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'],
    description: '16-color IBM palette',
  },
  {
    name: 'Pico-8',
    colors: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'],
    description: 'Fantasy console palette',
  },
  {
    name: 'NES',
    colors: ['#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#000000', '#000000', '#000000', '#BCBCBC', '#0078F8', '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10', '#AC7C00', '#00B800', '#00A800', '#00A844', '#008888', '#000000', '#000000', '#000000', '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8', '#F85898', '#F87858', '#FCA044', '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8', '#787878', '#000000', '#000000', '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8', '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#F8D8F8', '#000000', '#000000'],
    description: 'Nintendo Entertainment System',
  },
  {
    name: 'Retro',
    colors: ['#000000', '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86'],
    description: 'Sweetie 16 palette',
  },
  {
    name: 'Grayscale',
    colors: ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6', '#ffffff'],
    description: '11-step grayscale',
  },
  {
    name: 'Monochrome',
    colors: ['#000000', '#ffffff'],
    description: 'Pure black and white',
  },
];

/**
 * Find the nearest color in a palette using Euclidean RGB distance
 */
export function snapToNearestColor(hexColor: string, palette: string[]): string {
  if (palette.length === 0) return hexColor;

  const rgb = hexToRgb(hexColor);
  
  let minDist = Infinity;
  let nearest = palette[0];

  palette.forEach(paletteColor => {
    const paletteRgb = hexToRgb(paletteColor);
    const dist = colorDistance(rgb, paletteRgb);
    if (dist < minDist) {
      minDist = dist;
      nearest = paletteColor;
    }
  });

  return nearest;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
