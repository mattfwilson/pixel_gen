/**
 * Color quantization using k-means clustering
 * Reduces image colors to a limited palette
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Quantize colors to a limited palette using k-means clustering
 * @param colors Array of hex color strings
 * @param paletteSize Target number of colors (default: 16)
 * @param maxIterations Maximum k-means iterations (default: 10)
 * @returns Map from original color to quantized color
 */
export function quantizeColors(
  colors: string[],
  paletteSize: number = 16,
  maxIterations: number = 10
): Map<string, string> {
  if (colors.length <= paletteSize) {
    // No quantization needed
    const map = new Map<string, string>();
    colors.forEach(c => map.set(c, c));
    return map;
  }

  // Convert hex to RGB
  const rgbColors = colors.map(hexToRgb);

  // Initialize centroids with k-means++
  const centroids = initializeCentroids(rgbColors, paletteSize);

  // Run k-means clustering
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each color to nearest centroid
    const clusters: RGB[][] = Array.from({ length: paletteSize }, () => []);
    
    rgbColors.forEach(color => {
      const nearestIdx = findNearestCentroid(color, centroids);
      clusters[nearestIdx].push(color);
    });

    // Update centroids to cluster means
    let changed = false;
    for (let i = 0; i < paletteSize; i++) {
      if (clusters[i].length === 0) continue; // Empty cluster, keep old centroid
      
      const newCentroid = calculateMean(clusters[i]);
      if (colorDistance(centroids[i], newCentroid) > 1) {
        changed = true;
      }
      centroids[i] = newCentroid;
    }

    if (!changed) break; // Converged
  }

  // Build mapping from original colors to nearest centroid
  const colorMap = new Map<string, string>();
  colors.forEach((hexColor, idx) => {
    const rgb = rgbColors[idx];
    const nearestIdx = findNearestCentroid(rgb, centroids);
    const quantizedColor = rgbToHex(centroids[nearestIdx]);
    colorMap.set(hexColor, quantizedColor);
  });

  return colorMap;
}

/**
 * Initialize centroids using k-means++ algorithm
 */
function initializeCentroids(colors: RGB[], k: number): RGB[] {
  const centroids: RGB[] = [];
  
  // First centroid: random color
  centroids.push(colors[Math.floor(Math.random() * colors.length)]);

  // Remaining centroids: choose colors far from existing centroids
  while (centroids.length < k) {
    const distances = colors.map(color => {
      const minDist = Math.min(...centroids.map(c => colorDistance(color, c)));
      return minDist;
    });

    // Weighted random selection (favor distant colors)
    const totalDist = distances.reduce((sum, d) => sum + d * d, 0);
    let rand = Math.random() * totalDist;
    
    for (let i = 0; i < colors.length; i++) {
      rand -= distances[i] * distances[i];
      if (rand <= 0) {
        centroids.push(colors[i]);
        break;
      }
    }
  }

  return centroids;
}

/**
 * Find index of nearest centroid to a color
 */
function findNearestCentroid(color: RGB, centroids: RGB[]): number {
  let minDist = Infinity;
  let minIdx = 0;

  centroids.forEach((centroid, idx) => {
    const dist = colorDistance(color, centroid);
    if (dist < minDist) {
      minDist = dist;
      minIdx = idx;
    }
  });

  return minIdx;
}

/**
 * Calculate mean of RGB colors
 */
function calculateMean(colors: RGB[]): RGB {
  const sum = colors.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(sum.r / colors.length),
    g: Math.round(sum.g / colors.length),
    b: Math.round(sum.b / colors.length),
  };
}

/**
 * Euclidean distance between two RGB colors
 */
function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(rgb: RGB): string {
  return '#' + [rgb.r, rgb.g, rgb.b]
    .map(x => Math.round(x).toString(16).padStart(2, '0'))
    .join('');
}
