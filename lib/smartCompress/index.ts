/**
 * Smart Compress Pipeline
 *
 * Orchestrates: analyse → decide → sharpen? → compress.
 * Exported as a single async function that is a drop-in replacement for
 * the manual sharp().jpeg() call in the compress API route.
 */

import sharp from 'sharp';
import { analyzeImage } from './analyzer';
import { computeCompressionSettings } from './decisionEngine';
import type { ContentType } from './analyzer';
import type { CompressionSettings } from './decisionEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SmartCompressResult {
  outputBuffer: Buffer;
  /** Detected content category used for the compression decision */
  contentType: ContentType;
  /** The settings that were applied */
  settings: CompressionSettings;
  /** Positive = smaller output; negative = output was larger (caller should serve original) */
  savedBytes: number;
  /** Percentage saved relative to input size (0–100). Negative means larger. */
  savingsPercent: number;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Analyses `inputBuffer`, selects per-image compression settings, applies an
 * optional sharpening pre-pass, and encodes to JPEG.
 *
 * @param inputBuffer  Raw bytes of the source image (any Sharp-supported format)
 * @param mimeType     MIME type of the source, e.g. 'image/jpeg'
 */
export async function smartCompress(
  inputBuffer: Buffer,
  mimeType: string,
): Promise<SmartCompressResult> {
  // ── Phase 1: Analyse ──────────────────────────────────────────────────────
  const profile = await analyzeImage(inputBuffer);

  // ── Phase 2: Decide ───────────────────────────────────────────────────────
  const settings = computeCompressionSettings(profile);

  // ── Phase 3: Optional sharpening pre-pass ─────────────────────────────────
  /**
   * Sharpening is applied BEFORE compression intentionally. JPEG's DCT
   * introduces a mild low-pass effect; pre-sharpening compensates so the
   * final perceived sharpness matches the uncompressed source rather than
   * over-sharpening which would create halos visible in the compressed output.
   */
  let pipeline = sharp(inputBuffer);

  if (settings.sharpenBeforeCompress && settings.sharpenSigma > 0) {
    pipeline = pipeline.sharpen({
      sigma: settings.sharpenSigma,
      m1: settings.sharpenAmount,         // flat-area sharpening weight
      m2: settings.sharpenAmount * 0.5,   // jagged-area weight (gentler — avoids halos)
    });
  }

  // ── Phase 4: Compress ─────────────────────────────────────────────────────
  let outputBuffer: Buffer;

  /**
   * For non-JPEG inputs we still output JPEG (the caller asked for smart JPEG
   * compression). WebP or PNG inputs are decoded by Sharp transparently;
   * chromaSubsampling and mozjpeg still apply to the JPEG output stage.
   */
  outputBuffer = await pipeline
    .jpeg({
      quality: settings.jpegQuality,
      chromaSubsampling: settings.chromaSubsampling,
      mozjpeg: settings.mozjpegOptimise,
    })
    .toBuffer();

  const savedBytes = inputBuffer.length - outputBuffer.length;
  const savingsPercent = (savedBytes / inputBuffer.length) * 100;

  return {
    outputBuffer,
    contentType: profile.contentType,
    settings,
    savedBytes,
    savingsPercent,
  };
}
