// ── Lissajous Curve Mathematics ─────────────────────────────────────
// Canonical source for the Lightfast logo curve and all derived patterns.
// Parametric form: x(t) = sin(a·t + δ), y(t) = sin(b·t)

/** Default logo curve parameters: a=3, b=2, δ=π/2 */
export const LOGO_CURVE = { a: 3, b: 2, delta: Math.PI / 2 } as const;

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
  a: number = LOGO_CURVE.a,
  b: number = LOGO_CURVE.b,
  delta: number = LOGO_CURVE.delta,
  steps = 512
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
 * Generate raw [x,y] points for a Lissajous curve.
 * Used by: landing-hero logo animation (needs individual points for trail effect).
 */
export function lissajousPoints(
  a = LOGO_CURVE.a,
  b = LOGO_CURVE.b,
  delta = LOGO_CURVE.delta,
  steps = 512
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    points.push([Math.sin(a * t + delta), Math.sin(b * t)]);
  }
  return points;
}
