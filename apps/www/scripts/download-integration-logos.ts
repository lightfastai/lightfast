#!/usr/bin/env node

/**
 * Script to download integration logos from Simple Icons CDN
 * Run with: pnpm tsx scripts/download-integration-logos.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const integrations = [
	{ name: "GitHub", slug: "github" },
	{ name: "Notion", slug: "notion" },
	{ name: "Airtable", slug: "airtable" },
	{ name: "Gmail", slug: "gmail" },
	{ name: "Google Docs", slug: "googledocs" },
	{ name: "Google Sheets", slug: "googlesheets" },
	{ name: "Linear", slug: "linear" },
	{ name: "Slack", slug: "slack" },
	{ name: "Discord", slug: "discord" },
	{ name: "Sentry", slug: "sentry" },
	{ name: "PostHog", slug: "posthog" },
	{ name: "Datadog", slug: "datadog" },
	{ name: "Vercel", slug: "vercel" },
];

const OUTPUT_DIR = join(process.cwd(), "public", "integrations");
const CDN_BASE_URL = "https://cdn.simpleicons.org";

async function downloadLogo(slug: string): Promise<string> {
	const url = `${CDN_BASE_URL}/${slug}`;
	console.log(`Downloading ${slug} from ${url}...`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to download ${slug}: ${response.status} ${response.statusText}`,
		);
	}

	let svgContent = await response.text();

	// Replace hardcoded fill colors with currentColor to respect CSS color
	svgContent = svgContent.replace(/fill="[^"]+"/g, 'fill="currentColor"');

	return svgContent;
}

async function main() {
	try {
		// Create output directory if it doesn't exist
		await mkdir(OUTPUT_DIR, { recursive: true });
		console.log(`Output directory: ${OUTPUT_DIR}\n`);

		// Download each logo
		for (const integration of integrations) {
			try {
				const svgContent = await downloadLogo(integration.slug);
				const filename = `${integration.slug}.svg`;
				const filepath = join(OUTPUT_DIR, filename);

				await writeFile(filepath, svgContent, "utf-8");
				console.log(`✓ Saved ${integration.name} to ${filename}`);
			} catch (error) {
				console.error(`✗ Failed to download ${integration.name}:`, error);
			}
		}

		console.log("\n✓ All logos downloaded successfully!");
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
