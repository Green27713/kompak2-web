/**
 * Image Content Analyzer
 *
 * Decodes a compressed image buffer, downsamples it to a fixed analysis grid,
 * and derives a ContentProfile through pixel-level statistics and edge detection.
 * All analysis happens on a 128×128 working copy so cost is O(16 384) pixels
 * regardless of input dimensions.
 */

import sharp from 'sharp';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ContentType = 'portrait' | 'product' | 'screenshot' | 'landscape' | 'graphic';
export type LuminanceProfile = 'bright' | 'dark' | 'mixed';
export type ChromaComplexity = 'low' | 'medium' | 'high';

export interface ContentProfile {
  contentType: ContentType;
  luminanceProfile: LuminanceProfile;
  hasSharpEdges: boolean;
  chromaComplexity: ChromaComplexity;
  hasTransparency: boolean;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PixelMetrics {
  luminanceMean: number;
  saturationMean: number;
  saturationStdDev: number;
  /** Fraction of center-crop pixels that match skin-tone HSL criteria */
  skinPixelFraction: number;
  /** Average greyscale brightness (0-255) in the four corner patches */
  cornerBrightnessMean: number;
  /** Count of occupied 10°-wide hue buckets (0–36); only saturated pixels count */
  uniqueHueBuckets: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYSIS_SIZE = 128;

/**
 * Edge pixel threshold on the Laplacian response.
 * With offset=128, a flat region reads 128; deviation beyond this value
 * indicates a luminance gradient steep enough to be perceived as an edge.
 */
const EDGE_THRESHOLD = 15;

// ─── Colour space helpers ─────────────────────────────────────────────────────

/**
 * Converts sRGB (0–255 each) to HSL.
 * Returns hue in degrees (0–360), saturation and lightness in [0, 1].
 *
 * Perceptual note: HSL gives us human-readable colour descriptors.
 * Skin tones cluster tightly in HSL space (hue 0–50°, moderate sat & lum)
 * while staying diffuse in raw RGB, which is why we convert here.
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l]; // achromatic — no meaningful hue

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }

  return [h * 360, s, l];
}

// ─── Pixel statistics ─────────────────────────────────────────────────────────

/**
 * Scans the flat RGB pixel array (3 bytes per pixel, no alpha) and computes
 * statistical measures used by the content-type classifier.
 */
function analyzeRgbPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
): PixelMetrics {
  const total = width * height;

  // Centre crop boundaries (inner 50% by area)
  const cx0 = Math.floor(width * 0.25);
  const cx1 = Math.floor(width * 0.75);
  const cy0 = Math.floor(height * 0.25);
  const cy1 = Math.floor(height * 0.75);
  const centerArea = (cx1 - cx0) * (cy1 - cy0);

  // Corner patch size — 8×8 at 128×128
  const cornerPatch = Math.max(1, Math.floor(width * 0.0625));

  let lumSum = 0;
  let satSum = 0;
  let skinCount = 0;
  let cornerSum = 0;
  let cornerCount = 0;
  const hueBuckets = new Set<number>();
  const saturations: number[] = new Array(total) as number[];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const r = pixels[idx] as number;
      const g = pixels[idx + 1] as number;
      const b = pixels[idx + 2] as number;
      const [h, s, l] = rgbToHsl(r, g, b);
      const i = y * width + x;

      lumSum += l;
      satSum += s;
      saturations[i] = s;

      // Hue bucket for colour diversity (only saturated pixels contribute)
      if (s > 0.10) {
        hueBuckets.add(Math.floor(h / 10)); // 36 possible buckets of 10°
      }

      /**
       * Skin-tone detection — centre crop only.
       * Criteria (empirical from photographic datasets):
       *   hue   0–50°   : red–orange–yellow band covering all human skin tones
       *   sat > 0.20    : excludes near-achromatic neutrals and greys
       *   lum  0.30–0.80: excludes very dark shadows and blown-out highlights
       */
      const inCenter = x >= cx0 && x < cx1 && y >= cy0 && y < cy1;
      if (inCenter && h >= 0 && h <= 50 && s > 0.20 && l >= 0.30 && l <= 0.80) {
        skinCount++;
      }

      /**
       * Corner brightness — four corner patches.
       * Product photos on white/neutral backgrounds have near-255 corners.
       * Natural scenes rarely do.
       */
      const inCorner =
        (x < cornerPatch && y < cornerPatch) ||
        (x >= width - cornerPatch && y < cornerPatch) ||
        (x < cornerPatch && y >= height - cornerPatch) ||
        (x >= width - cornerPatch && y >= height - cornerPatch);

      if (inCorner) {
        cornerSum += (r + g + b) / 3;
        cornerCount++;
      }
    }
  }

  const luminanceMean = lumSum / total;
  const saturationMean = satSum / total;
  const satVariance =
    saturations.reduce((acc, s) => acc + (s - saturationMean) ** 2, 0) / total;

  return {
    luminanceMean,
    saturationMean,
    saturationStdDev: Math.sqrt(satVariance),
    skinPixelFraction: centerArea > 0 ? skinCount / centerArea : 0,
    cornerBrightnessMean: cornerCount > 0 ? cornerSum / cornerCount : 0,
    uniqueHueBuckets: hueBuckets.size,
  };
}

// ─── Edge detection ───────────────────────────────────────────────────────────

/**
 * Applies a discrete Laplacian kernel to a greyscale version of the image
 * and returns the fraction of pixels that exceed the edge threshold.
 *
 * Laplacian kernel:
 *   [ 0  1  0 ]
 *   [ 1 -4  1 ]
 *   [ 0  1  0 ]
 *
 * With scale=1 and offset=128, flat regions read 128 (neutral), while
 * edges produce responses that deviate sharply in either direction.
 * This is preferred over gradient-magnitude (Sobel) because it captures
 * both the rising and falling slope of every edge in a single pass.
 */
async function computeEdgeDensity(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer)
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'fill' })
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      offset: 128,
      scale: 1,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const total = info.width * info.height;
  let edgeCount = 0;
  for (const p of pixels) {
    if (Math.abs(p - 128) > EDGE_THRESHOLD) edgeCount++;
  }
  return edgeCount / total;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyses an encoded image buffer (JPEG, PNG, WebP, etc.) and returns a
 * ContentProfile describing its perceptual characteristics.
 *
 * All downstream compression decisions are derived from this profile;
 * no quality numbers appear here — only semantic observations.
 */
export async function analyzeImage(buffer: Buffer): Promise<ContentProfile> {
  // ── Metadata ────────────────────────────────────────────────────────────────
  const meta = await sharp(buffer).metadata();
  const hasTransparency = meta.hasAlpha ?? false;

  // ── Pixel analysis ──────────────────────────────────────────────────────────
  const { data, info } = await sharp(buffer)
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'fill' })
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const metrics = analyzeRgbPixels(pixels, info.width, info.height);

  // ── Edge density ────────────────────────────────────────────────────────────
  const edgeDensity = await computeEdgeDensity(buffer);

  // ── Luminance profile ───────────────────────────────────────────────────────
  /**
   * Perceptual note: JPEG uses an 8×8 DCT, so dark images (where most energy
   * is in AC coefficients) show blocking artifacts at the same quality setting
   * as bright images. We flag darkness so the decision engine can compensate.
   */
  let luminanceProfile: LuminanceProfile;
  if (metrics.luminanceMean > 0.65) {
    luminanceProfile = 'bright';
  } else if (metrics.luminanceMean < 0.35) {
    luminanceProfile = 'dark';
  } else {
    luminanceProfile = 'mixed';
  }

  // ── Sharp-edge flag ─────────────────────────────────────────────────────────
  const hasSharpEdges = edgeDensity > 0.15;

  // ── Chroma complexity ───────────────────────────────────────────────────────
  /**
   * Saturation standard deviation measures how widely chroma varies across
   * the image. A portrait has a smooth gradient of skin saturation → low stdev.
   * A complex illustration with many distinct hues → high stdev.
   */
  let chromaComplexity: ChromaComplexity;
  if (metrics.saturationStdDev < 0.10) {
    chromaComplexity = 'low';
  } else if (metrics.saturationStdDev < 0.20) {
    chromaComplexity = 'medium';
  } else {
    chromaComplexity = 'high';
  }

  // ── Content type classification ─────────────────────────────────────────────
  /**
   * Classification order matters: each check is listed from most specific
   * to least specific so that ambiguous cases fall through to the correct bucket.
   */
  let contentType: ContentType;

  if (edgeDensity > 0.30 && metrics.uniqueHueBuckets < 8) {
    /**
     * Screenshot: Very high edge density (pixel-perfect UI elements, text,
     * icons) combined with a limited colour palette (system UI, code editors).
     * A natural photo with many edges would still have diverse hues.
     */
    contentType = 'screenshot';
  } else if (metrics.skinPixelFraction > 0.15) {
    /**
     * Portrait: At least 15 % of the centre-crop pixels match skin-tone HSL.
     * We check the centre crop (not the whole image) to ignore backgrounds
     * and concentrate on the subject area where the face or body appears.
     */
    contentType = 'portrait';
  } else if (edgeDensity > 0.08 && metrics.cornerBrightnessMean > 220) {
    /**
     * Product: Defined subject with a neutral/white studio background.
     * The white corners signal the background; edges signal the product outline.
     * E-commerce product photography almost always fits this pattern.
     */
    contentType = 'product';
  } else if (metrics.uniqueHueBuckets < 6 && edgeDensity > 0.08) {
    /**
     * Graphic: Few distinct hues but clear geometric edges — logos, diagrams,
     * illustrated icons. The combination of limited palette and hard lines is
     * the key signal that distinguishes graphics from blurry low-contrast photos.
     */
    contentType = 'graphic';
  } else if (metrics.uniqueHueBuckets > 12) {
    /**
     * Landscape: Wide chromatic variety from sky, foliage, water, and ground.
     * Natural scenes span many hues even in muted weather conditions.
     */
    contentType = 'landscape';
  } else {
    contentType = 'landscape'; // safe default
  }

  return { contentType, luminanceProfile, hasSharpEdges, chromaComplexity, hasTransparency };
}
