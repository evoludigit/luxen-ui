// Colour plumbing for suites that measure painted contrast (WCAG 1.4.3, 1.4.11).
// `getComputedStyle` returns an element's own declared colour, which for a
// translucent token is not what lands on screen: composite down to an opaque
// backdrop with `over()` before measuring.

const canvas = document.createElement('canvas');
canvas.width = canvas.height = 1;
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

export type Rgba = [number, number, number, number];

/**
 * Parse any CSS colour (oklch, oklab, color-mix, light-dark…) into sRGB + alpha.
 *
 * A canvas silently keeps its previous `fillStyle` when handed a string it
 * cannot parse — including the empty string a custom property computes to once
 * one of its `var()`s is missing. Seeding twice with different colours turns
 * that silence into a throw: anything the canvas accepted resolves to the same
 * value from either seed, anything it rejected keeps the two seeds apart.
 *
 * Without this a suite measures a token that failed to resolve as opaque black
 * and reports the result as a contrast number, which is how a missing
 * `--l-form-control-disabled-mark-color` once read as "1.43:1, below the 3:1
 * floor" instead of "there is no thumb colour here at all". `hint` is appended
 * to the error, to say where an unresolved colour usually comes from.
 */
export function parse(color: string, hint = ''): Rgba {
  const seededWith = (seed: string) => {
    ctx.fillStyle = seed;
    ctx.fillStyle = color;
    return ctx.fillStyle;
  };
  if (seededWith('#000') !== seededWith('#fff')) {
    throw new Error(`Not a colour: ${JSON.stringify(color)}. ${hint}`.trim());
  }
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** Composite a (possibly translucent) colour over an opaque backdrop. */
export function over(fg: Rgba, bg: Rgba): Rgba {
  return [
    fg[0] * fg[3] + bg[0] * (1 - fg[3]),
    fg[1] * fg[3] + bg[1] * (1 - fg[3]),
    fg[2] * fg[3] + bg[2] * (1 - fg[3]),
    1,
  ];
}

export function luminance([r, g, b]: Rgba): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
