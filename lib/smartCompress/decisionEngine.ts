/**
 * Compression Decision Engine
 *
 * Translates a ContentProfile into concrete Sharp/mozjpeg settings.
 * Every number here is justified by a perceptual reason, not tuned blindly.
 * The function is pure (no I/O) so it is trivially unit-testable.
 */

import type { ContentProfile } from './analyzer';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CompressionSettings {
  jpegQuality: number;
  /**
   * Chroma subsampling ratio.
   *
   * 4:4:4 — full chroma resolution: every pixel carries its own colour.
   *          Use for text, logos, high-frequency colour detail.
   * 4:2:2 — halves horizontal chroma resolution.
   *          Preserves colour fidelity in portraits without adding much
   *          weight; our eye resolves luma (Y) far better than chroma (Cb/Cr).
   * 4:2:0 — quarters chroma resolution (halved in both axes).
   *          Ideal for sky, water, and smooth gradients where the eye
   *          naturally has low chroma acuity.
   */
  chromaSubsampling: '4:4:4' | '4:2:2' | '4:2:0';
  sharpenBeforeCompress: boolean;
  /** Gaussian sigma for the unsharp-mask pre-pass. 0 when no sharpen. */
  sharpenSigma: number;
  /** Flat-area sharpening weight (Sharp's m1 parameter). 0 when no sharpen. */
  sharpenAmount: number;
  /** Whether to enable mozjpeg's progressive scan + Huffman optimisation. */
  mozjpegOptimise: boolean;
}

// ─── Decision logic ───────────────────────────────────────────────────────────

/**
 * Maps a ContentProfile to the optimal CompressionSettings for that image class.
 *
 * Design principle: settings are chosen to maximise perceived quality at the
 * target file size for each content class, not to minimise PSNR or SSIM
 * (metrics that do not correlate well with human preference for photographs).
 */
export function computeCompressionSettings(profile: ContentProfile): CompressionSettings {
  let settings: CompressionSettings;

  switch (profile.contentType) {
    case 'portrait':
      /**
       * Portraits: the face is the focal point; skin texture and hair detail
       * are evaluated closely by viewers. Quality 82 preserves fine detail
       * without an excessive file size. 4:2:2 halves chroma horizontally
       * but keeps full vertical chroma — skin gradients run mainly vertically
       * (forehead → chin) so the halved dimension is the less critical one.
       * Mild unsharp mask (sigma=0.5) recovers the micro-contrast lost in the
       * JPEG DCT without introducing visible halos at skin/hair boundaries.
       */
      settings = {
        jpegQuality: 82,
        chromaSubsampling: '4:2:2',
        sharpenBeforeCompress: true,
        sharpenSigma: 0.5,
        sharpenAmount: 0.3,
        mozjpegOptimise: true,
      };
      break;

    case 'product':
      /**
       * Product photos: buyers zoom in to inspect texture, text on packaging,
       * and fine surface detail. 4:4:4 ensures no colour bleeding at sharp
       * material boundaries (metal edges, printed labels). Quality 85 sits just
       * above the threshold where DCT ringing on hard edges becomes visible
       * at 2× zoom. Stronger pre-sharpening (sigma=0.8, amount=0.6) restores
       * the crispness of studio-lit product shots that JPEG softens.
       */
      settings = {
        jpegQuality: 85,
        chromaSubsampling: '4:4:4',
        sharpenBeforeCompress: true,
        sharpenSigma: 0.8,
        sharpenAmount: 0.6,
        mozjpegOptimise: true,
      };
      break;

    case 'screenshot':
      /**
       * Screenshots: already pixel-perfect — every edge is axis-aligned and
       * already maximally sharp. Pre-sharpening would amplify DCT ringing at
       * text strokes, making them look fringed. 4:4:4 preserves the distinct
       * colours of UI elements (coloured icons, syntax highlighting) without
       * colour bleed. Quality 88 is conservative because text anti-aliasing
       * sits on a very narrow tonal curve that lower quality quantises badly.
       */
      settings = {
        jpegQuality: 88,
        chromaSubsampling: '4:4:4',
        sharpenBeforeCompress: false,
        sharpenSigma: 0,
        sharpenAmount: 0,
        mozjpegOptimise: true,
      };
      break;

    case 'landscape':
      /**
       * Landscapes: vast areas of sky, water, and foliage contain very little
       * high-frequency chroma information. 4:2:0 exploits the human visual
       * system's lower acuity to colour vs. luminance to achieve the best
       * compression ratio without visible colour posterisation. Quality 78 is
       * well above the banding threshold for smooth gradients and saves ~20%
       * file size versus quality 85. No sharpening — micro-contrast in fine
       * foliage or ripples would create visible halos on smooth sky areas.
       */
      settings = {
        jpegQuality: 78,
        chromaSubsampling: '4:2:0',
        sharpenBeforeCompress: false,
        sharpenSigma: 0,
        sharpenAmount: 0,
        mozjpegOptimise: true,
      };
      break;

    case 'graphic':
      /**
       * Graphics (logos, diagrams, illustrations): hard colour boundaries need
       * 4:4:4 to prevent the colour fringes that 4:2:0 produces at high-
       * contrast edges (e.g., a red logo on white would bleed). Quality 90
       * is high because the human eye is very sensitive to banding in flat
       * colour fills — even small DCT coefficient quantisation creates
       * visible gradients in areas meant to be uniform.
       */
      settings = {
        jpegQuality: 90,
        chromaSubsampling: '4:4:4',
        sharpenBeforeCompress: false,
        sharpenSigma: 0,
        sharpenAmount: 0,
        mozjpegOptimise: true,
      };
      break;
  }

  // ── Cross-cutting modifiers ─────────────────────────────────────────────────

  /**
   * Dark images: JPEG's DCT uses uniform quantisation tables, but human
   * contrast sensitivity is roughly logarithmic (Weber's law). The same
   * quantisation step causes more visible banding in shadows than in
   * mid-tones. +3 quality in dark images reduces shadow blocking without
   * a large file size penalty because shadow areas compress better overall.
   */
  if (profile.luminanceProfile === 'dark') {
    settings.jpegQuality = Math.min(95, settings.jpegQuality + 3);
  }

  /**
   * High chroma complexity: when saturation varies wildly across the frame,
   * 4:2:0 chroma subsampling merges too many distinct colour samples into one.
   * Elevating to at least 4:2:2 halves the damage; 4:4:4 classes already
   * covered above are left untouched.
   */
  if (
    profile.chromaComplexity === 'high' &&
    settings.chromaSubsampling === '4:2:0'
  ) {
    settings.chromaSubsampling = '4:2:2';
  }

  return settings;
}
