import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fontsDir = join(process.cwd(), "public/fonts/pp-neue-montreal");

export async function loadOGFonts() {
	const [medium, bold] = await Promise.all([
		readFile(join(fontsDir, "PPNeueMontreal-Medium.woff")),
		readFile(join(fontsDir, "PPNeueMontreal-Bold.woff")),
	]);

	return [
		{ name: "PP Neue Montreal", data: medium, weight: 500 as const, style: "normal" as const },
		{ name: "PP Neue Montreal", data: bold, weight: 700 as const, style: "normal" as const },
	];
}
