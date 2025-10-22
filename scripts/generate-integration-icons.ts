#!/usr/bin/env node

/**
 * Script to generate integration icon components from SVG files
 * Run with: pnpm tsx scripts/generate-integration-icons.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ICONS_DIR = join(
	process.cwd(),
	"apps/www/public/integrations",
);
const OUTPUT_FILE = join(
	process.cwd(),
	"packages/ui/src/components/integration-icons.tsx",
);

interface IconInfo {
	name: string;
	slug: string;
	svgContent: string;
}

async function getSVGFiles(): Promise<IconInfo[]> {
	const files = await readdir(ICONS_DIR);
	const svgFiles = files.filter((file) => file.endsWith(".svg"));

	const icons: IconInfo[] = [];

	for (const file of svgFiles) {
		const slug = file.replace(".svg", "");
		const svgPath = join(ICONS_DIR, file);
		const svgContent = await readFile(svgPath, "utf-8");

		// Convert slug to proper name (e.g., "github" -> "github", "googledocs" -> "googledocs")
		const name = slug;

		icons.push({ name, slug, svgContent });
	}

	return icons;
}

function parseSVG(svgContent: string): { attributes: string; paths: string } {
	// Extract attributes from svg tag (everything except the opening <svg and closing >)
	const svgTagMatch = svgContent.match(/<svg([^>]+)>/);
	if (!svgTagMatch) {
		throw new Error("Could not parse SVG tag");
	}

	let attributes = svgTagMatch[1].trim();

	// Remove xmlns if present (we'll add it in the template)
	attributes = attributes.replace(/xmlns="[^"]+"\s*/g, "");

	// Remove width and height attributes (keep viewBox for aspect ratio)
	// This allows CSS classes like h-8 w-auto to control sizing
	attributes = attributes.replace(/width="[^"]+"\s*/g, "");
	attributes = attributes.replace(/height="[^"]+"\s*/g, "");

	// Extract everything between <svg> and </svg>
	const innerContent = svgContent
		.replace(/<svg[^>]+>/, "")
		.replace(/<\/svg>/, "")
		.trim();

	return { attributes, paths: innerContent };
}

function generateIconComponent(icon: IconInfo): string {
	const { attributes, paths } = parseSVG(icon.svgContent);

	return `\t${icon.name}: (props: IconProps) => (
\t\t<svg ${attributes} {...props}>
\t\t\t${paths}
\t\t</svg>
\t),`;
}

async function generateIconsFile(icons: IconInfo[]): Promise<void> {
	const iconComponents = icons
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(generateIconComponent)
		.join("\n");

	const fileContent = `type IconProps = React.HTMLAttributes<SVGElement>;

export const IntegrationIcons = {
${iconComponents}
};
`;

	await writeFile(OUTPUT_FILE, fileContent, "utf-8");
	console.log(`✓ Generated ${icons.length} integration icons in ${OUTPUT_FILE}`);
}

async function main() {
	try {
		console.log("Reading SVG files from", ICONS_DIR);
		const icons = await getSVGFiles();
		console.log(`Found ${icons.length} SVG files`);

		await generateIconsFile(icons);

		console.log("\n✓ Integration icons generated successfully!");
		console.log(
			"\nYou can now import them with: import { IntegrationIcons } from '@repo/ui/integration-icons'",
		);
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
