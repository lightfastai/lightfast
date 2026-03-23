// ── Lissajous Curve Mathematics ─────────────────────────────────────
// Canonical source for the Lightfast logo curve and all derived patterns.
// Parametric form: x(t) = sin(a·t + δ), y(t) = sin(b·t)

/** Default logo curve parameters: a=3, b=2, δ=π/2 */
export const LOGO_CURVE = { a: 3, b: 2, delta: Math.PI / 2 } as const;

/** All 9 footer/brand patterns */
export const LISSAJOUS_PATTERNS = [
  { name: "circle", a: 1, b: 1, delta: Math.PI / 2 },
  { name: "figure8", a: 1, b: 2, delta: Math.PI / 2 },
  { name: "pretzel", a: 3, b: 2, delta: Math.PI / 2 },
  { name: "bow", a: 2, b: 3, delta: Math.PI / 2 },
  { name: "knot", a: 3, b: 4, delta: Math.PI / 2 },
  { name: "star", a: 5, b: 4, delta: Math.PI / 2 },
  { name: "wave", a: 1, b: 3, delta: Math.PI / 4 },
  { name: "infinity", a: 2, b: 1, delta: Math.PI / 2 },
  { name: "clover", a: 3, b: 1, delta: Math.PI / 2 },
] as const;

/**
 * Generate an SVG path for a Lissajous curve centered in a square canvas.
 * Used by: Logo component (Remotion), OG images (Satori), footer (React).
 *
 * @param size - Canvas width/height in px
 * @param padding - Fraction of size reserved as padding (0–0.5)
 * @param a - x-frequency (default: LOGO_CURVE.a)
 * @param b - y-frequency (default: LOGO_CURVE.b)
 * @param delta - phase shift (default: LOGO_CURVE.delta)
 * @param steps - number of sample points (default: 512)
 */
export function lissajousPath(
  size: number,
  padding: number,
  a = LOGO_CURVE.a,
  b = LOGO_CURVE.b,
  delta = LOGO_CURVE.delta,
  steps = 512,
): string {
  const center = size / 2;
  const radius = size * (0.5 - padding);

  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const x = center + radius * Math.sin(a * t + delta);
    const y = center + radius * Math.sin(b * t);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${d} Z`;
}

/**
 * Generate an SVG path for a Lissajous curve in a normalized viewBox (0–100).
 * Used by: footer patterns.
 */
export function lissajousPathNormalized(
  a: number,
  b: number,
  delta: number,
  points = 500,
  padding = 10,
): string {
  const size = 100 - padding * 2;
  const pts: string[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI;
    const x = padding + ((Math.sin(a * t + delta) + 1) / 2) * size;
    const y = padding + ((Math.sin(b * t) + 1) / 2) * size;
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

/**
 * Generate raw [x,y] points for a Lissajous curve.
 * Used by: landing-hero logo animation (needs individual points for trail effect).
 */
export function lissajousPoints(
  a = LOGO_CURVE.a,
  b = LOGO_CURVE.b,
  delta = LOGO_CURVE.delta,
  steps = 512,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    points.push([Math.sin(a * t + delta), Math.sin(b * t)]);
  }
  return points;
}
