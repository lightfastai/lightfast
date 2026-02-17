const A = 3;
const B = 2;
const DELTA = Math.PI / 2;
const STEPS = 512;

/**
 * Generate the Lissajous curve SVG path for the Lightfast logo.
 * Parametric form: x(t) = sin(3t + π/2), y(t) = sin(2t)
 */
export function lissajousPath(size: number, padding: number): string {
	const center = size / 2;
	const radius = size * (0.5 - padding);

	let d = "";
	for (let i = 0; i <= STEPS; i++) {
		const t = (i / STEPS) * 2 * Math.PI;
		const x = center + radius * Math.sin(A * t + DELTA);
		const y = center + radius * Math.sin(B * t);
		d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
	}
	return d + " Z";
}
