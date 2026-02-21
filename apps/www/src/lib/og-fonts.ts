import { readFile } from "node:fs/promises";
import { join } from "node:path";

const neueFontsDir = join(process.cwd(), "public/fonts/pp-neue-montreal");
const supplyFontsDir = join(process.cwd(), "public/fonts/pp-supply-sans");

export async function loadOGFonts() {
	const [medium, bold, supplyRegular] = await Promise.all([
		readFile(join(neueFontsDir, "PPNeueMontreal-Medium.woff")),
		readFile(join(neueFontsDir, "PPNeueMontreal-Bold.woff")),
		readFile(join(supplyFontsDir, "PPSupplySans-Regular.woff")),
	]);

	return [
		{ name: "PP Neue Montreal", data: medium, weight: 500 as const, style: "normal" as const },
		{ name: "PP Neue Montreal", data: bold, weight: 700 as const, style: "normal" as const },
		{ name: "PP Supply Sans", data: supplyRegular, weight: 400 as const, style: "normal" as const },
	];
}
