/**
 * Logarithmic mapping between a linear slider value and pixelSize.
 *
 * Problem with a linear slider:
 *   pixelSize drives outputPixels = floor(imgMin / pixelSize)  — a hyperbolic (1/x) curve.
 *   A linear slider on a hyperbolic function packs almost all perceptible change
 *   into the first ~10 % of travel; the remaining 90 % is a dead zone.
 *
 * Fix — map the slider to *output pixel count* on a logarithmic scale:
 *   out(t) = round(exp(ln(imgMin) + t × (ln(2) − ln(imgMin))))
 *          = round(imgMin^(1−t) × 2^t)
 *
 *   t = 0  →  out = imgMin  (most detail, pixelSize = 1)
 *   t = 1  →  out = 2       (most pixelated, pixelSize = floor(imgMin/2))
 *
 * Every equal step along t produces the same perceptual ratio change (~1.4–1.9×
 * smaller output), so the slider feels evenly distributed.
 *
 * The HTML range input stores an integer in [0 .. SLIDER_STEPS].
 * sliderValToPixelSize / pixelSizeToSliderVal convert between the two domains.
 */

/** Number of integer steps the range input uses. High enough for smooth dragging. */
export const SLIDER_STEPS = 1000;

/**
 * Convert a normalized position t ∈ [0,1] to output pixel count.
 * t=0 → imgMin output pixels (full detail)
 * t=1 → 2 output pixels (most pixelated)
 */
function outAtT(t: number, imgMin: number): number {
  if (imgMin <= 2) return Math.max(1, imgMin);
  return Math.max(2, Math.round(
    Math.exp(Math.log(imgMin) + t * (Math.log(2) - Math.log(imgMin)))
  ));
}

/**
 * Convert a slider integer value [0..SLIDER_STEPS] to a pixelSize integer.
 * val=0      → pixelSize=1            (most detail)
 * val=STEPS  → pixelSize=floor(imgMin/2)  (most pixelated, output=2px)
 *
 * @param val      Current slider integer value
 * @param imgMin   Shortest dimension of the source image in pixels
 */
export function sliderValToPixelSize(val: number, imgMin: number): number {
  if (!imgMin || imgMin <= 1) return 1;
  const t   = val / SLIDER_STEPS;
  const out = outAtT(t, imgMin);
  return Math.max(1, Math.floor(imgMin / out));
}

/**
 * Convert a pixelSize integer back to a slider value [0..SLIDER_STEPS].
 * Used when a new image is loaded so the thumb stays in the right position.
 *
 * @param pixelSize  Current pixelSize
 * @param imgMin     Shortest dimension of the source image in pixels
 */
export function pixelSizeToSliderVal(pixelSize: number, imgMin: number): number {
  if (!imgMin || imgMin <= 2) return 0;
  const out = Math.max(2, Math.floor(imgMin / Math.max(1, pixelSize)));
  const t   = (Math.log(imgMin) - Math.log(out)) / (Math.log(imgMin) - Math.log(2));
  return Math.max(0, Math.min(SLIDER_STEPS, Math.round(t * SLIDER_STEPS)));
}

/**
 * Compute the output grid dimensions from a pixelSize and source image size.
 * Useful for displaying the label ("32 × 32 output").
 */
export function outputDimensions(
  pixelSize: number,
  imgWidth:  number,
  imgHeight: number,
): { w: number; h: number } {
  return {
    w: Math.max(1, Math.floor(imgWidth  / pixelSize)),
    h: Math.max(1, Math.floor(imgHeight / pixelSize)),
  };
}
