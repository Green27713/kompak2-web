/**
 * Analyzer unit tests — synthetic image fixtures
 *
 * Each test constructs a minimal 128×128 raw RGB buffer designed to
 * trigger exactly one content-type branch, then verifies the classifier
 * returns the expected ContentType and related profile fields.
 *
 * Images are encoded as PNG (lossless) before being passed to analyzeImage
 * so that pixel values are preserved exactly — JPEG artefacts would disturb
 * edge-density and hue-bucket counts.
 *
 * Run with:
 *   npx vitest run lib/smartCompress/__tests__/analyzer.test.ts
 * or add vitest to devDependencies and run: npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { analyzeImage } from '../analyzer';

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 128;
const H = 128;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a flat RGB buffer filled with one colour. */
function solidBuffer(r: number, g: number, b: number): Buffer {
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = r;
    buf[i * 3 + 1] = g;
    buf[i * 3 + 2] = b;
  }
  return buf;
}

/**
 * Build a black/white checkerboard with `blockSize`-pixel blocks.
 * Very small blocks produce extremely high Laplacian edge density
 * with a near-zero colour palette — the hallmark of a screenshot.
 */
function checkerboard(blockSize: number): Buffer {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v =
        (Math.floor(x / blockSize) + Math.floor(y / blockSize)) % 2 === 0
          ? 255
          : 0;
      const i = (y * W + x) * 3;
      buf[i] = v;
      buf[i + 1] = v;
      buf[i + 2] = v;
    }
  }
  return buf;
}

/**
 * HSL → RGB (all inputs/outputs in [0,1] then scaled to 0–255).
 * Used to build the hue-gradient landscape fixture.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue2rgb = (p: number, q: number, t: number): number => {
    const tt = ((t % 1) + 1) % 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Build a horizontal hue gradient from `startDeg` to `endDeg` at full
 * saturation and 50 % lightness. Spanning > 12 ten-degree buckets triggers
 * the "landscape" classifier.
 *
 * We use 60–300 ° (yellow→magenta) to avoid the skin-tone range (0–50 °)
 * so the portrait classifier does not fire first.
 */
function hueGradient(startDeg: number, endDeg: number): Buffer {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hue = startDeg + (x / (W - 1)) * (endDeg - startDeg);
      const [r, g, b] = hslToRgb(hue / 360, 0.8, 0.5);
      const i = (y * W + x) * 3;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }
  return buf;
}

/**
 * Build horizontal colour bands of equal height, cycling through `colors`.
 * Used for the graphic fixture (few distinct hues + defined edges).
 *
 * We use green (120 °) and blue (240 °) to stay out of the skin-tone range.
 */
function colorBands(
  colors: [number, number, number][],
  bandHeight: number,
): Buffer {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const [r, g, b] = colors[Math.floor(y / bandHeight) % colors.length]!;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }
  return buf;
}

/**
 * Build a product-photo proxy: white background with a greyscale striped
 * region in the centre 60 %. White corners satisfy the brightness check;
 * the stripe transitions provide edge density above the product threshold.
 */
function productLike(): Buffer {
  const buf = Buffer.alloc(W * H * 3, 255); // white background
  const cx0 = Math.floor(W * 0.20);
  const cx1 = Math.floor(W * 0.80);
  const cy0 = Math.floor(H * 0.20);
  const cy1 = Math.floor(H * 0.80);
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const v = Math.floor((x - cx0) / 4) % 2 === 0 ? 100 : 190;
      const i = (y * W + x) * 3;
      buf[i] = v;
      buf[i + 1] = v;
      buf[i + 2] = v;
    }
  }
  return buf;
}

/** Encode a raw RGB buffer as PNG (lossless) so analyzeImage can decode it. */
async function toPng(rawBuf: Buffer): Promise<Buffer> {
  return sharp(rawBuf, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

// ─── Fixtures (built once before all tests) ───────────────────────────────────

let portraitImg: Buffer;
let screenshotImg: Buffer;
let landscapeImg: Buffer;
let graphicImg: Buffer;
let productImg: Buffer;

beforeAll(async () => {
  /**
   * Portrait: solid skin tone (r=210, g=170, b=130).
   * HSL ≈ hue 30°, sat 0.47, lum 0.67 — squarely inside the skin-tone criteria
   * for every pixel in the centre crop, so skinPixelFraction = 1.0.
   */
  portraitImg = await toPng(solidBuffer(210, 170, 130));

  /**
   * Screenshot: 2-pixel checkerboard (black/white).
   * Every pixel is adjacent to its opposite, maximising Laplacian response.
   * B/W pixels are achromatic → saturation = 0 → uniqueHueBuckets = 0.
   */
  screenshotImg = await toPng(checkerboard(2));

  /**
   * Landscape: horizontal hue gradient 60°→300° at full saturation.
   * Covers 24 ten-degree hue buckets → well above the 12-bucket threshold.
   * Starting at 60° avoids the skin-tone range (0–50°).
   */
  landscapeImg = await toPng(hueGradient(60, 300));

  /**
   * Graphic: 8-pixel alternating green/blue horizontal bands.
   * Green (hue≈120°) and blue (hue≈240°) → 2 hue buckets (< 6 threshold).
   * Band transitions produce ~25% edge density (> 0.08 threshold).
   * Neither white corners nor skin tones, so portrait/product don't fire.
   */
  graphicImg = await toPng(
    colorBands(
      [[0, 180, 0], [0, 0, 200]],
      8,
    ),
  );

  /**
   * Product: white background with 4-pixel greyscale stripes in centre 60%.
   * Corners are white (brightness 255 > 220). Stripe edges produce edge
   * density ~15–20% (> 0.08 threshold). Greyscale centre → no skin pixels.
   */
  productImg = await toPng(productLike());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeImage — contentType detection', () => {
  it('detects portrait from skin-tone image', async () => {
    const profile = await analyzeImage(portraitImg);
    expect(profile.contentType).toBe('portrait');
  });

  it('detects screenshot from checkerboard pattern', async () => {
    const profile = await analyzeImage(screenshotImg);
    expect(profile.contentType).toBe('screenshot');
    // Screenshots should always flag hasSharpEdges
    expect(profile.hasSharpEdges).toBe(true);
  });

  it('detects landscape from wide hue gradient', async () => {
    const profile = await analyzeImage(landscapeImg);
    expect(profile.contentType).toBe('landscape');
  });

  it('detects graphic from two-colour banded pattern', async () => {
    const profile = await analyzeImage(graphicImg);
    expect(profile.contentType).toBe('graphic');
  });

  it('detects product from white-background striped fixture', async () => {
    const profile = await analyzeImage(productImg);
    expect(profile.contentType).toBe('product');
  });
});

describe('analyzeImage — luminanceProfile', () => {
  it('labels a near-white image as bright', async () => {
    const img = await toPng(solidBuffer(230, 230, 230));
    const profile = await analyzeImage(img);
    expect(profile.luminanceProfile).toBe('bright');
  });

  it('labels a near-black image as dark', async () => {
    const img = await toPng(solidBuffer(30, 30, 30));
    const profile = await analyzeImage(img);
    expect(profile.luminanceProfile).toBe('dark');
  });
});

describe('analyzeImage — chromaComplexity', () => {
  it('returns low complexity for an achromatic image', async () => {
    const img = await toPng(solidBuffer(128, 128, 128));
    const profile = await analyzeImage(img);
    expect(profile.chromaComplexity).toBe('low');
  });
});

describe('analyzeImage — hasTransparency', () => {
  it('returns false for an opaque JPEG', async () => {
    // JPEG has no alpha channel by definition
    const jpg = await sharp(solidBuffer(100, 150, 200), {
      raw: { width: W, height: H, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    const profile = await analyzeImage(jpg);
    expect(profile.hasTransparency).toBe(false);
  });

  it('returns true for a PNG with an alpha channel', async () => {
    // Build an RGBA raw buffer (4 channels, partially transparent)
    const rgba = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      rgba[i * 4] = 200;
      rgba[i * 4 + 1] = 100;
      rgba[i * 4 + 2] = 50;
      rgba[i * 4 + 3] = 128; // 50 % opacity
    }
    const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .png()
      .toBuffer();
    const profile = await analyzeImage(png);
    expect(profile.hasTransparency).toBe(true);
  });
});
