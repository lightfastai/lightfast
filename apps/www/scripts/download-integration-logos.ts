#!/usr/bin/env node

/**
 * Script to download integration logos and wordmarks from various CDNs
 * - Downloads wordmarks where available (icon + brand text)
 * - Falls back to icon-only from Simple Icons
 * Run with: pnpm tsx scripts/download-integration-logos.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface Integration {
	name: string;
	slug: string;
	wordmarkUrl?: string;
	iconUrl?: string;
}

const integrations: Integration[] = [
	// Wordmarks available via devicons CDN
	{
		name: "GitHub",
		slug: "github",
		wordmarkUrl:
			"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original-wordmark.svg",
	},
	{
		name: "Slack",
		slug: "slack",
		wordmarkUrl:
			"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original-wordmark.svg",
	},
	{
		name: "Vercel",
		slug: "vercel",
		wordmarkUrl:
			"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original-wordmark.svg",
	},
	// Wordmarks available via VectorLogo.Zone
	{
		name: "Airtable",
		slug: "airtable",
		wordmarkUrl: "https://www.vectorlogo.zone/logos/airtable/airtable-ar21.svg",
	},
	{
		name: "Sentry",
		slug: "sentry",
		wordmarkUrl: "https://www.vectorlogo.zone/logos/sentryio/sentryio-ar21.svg",
	},
	{
		name: "Datadog",
		slug: "datadog",
		wordmarkUrl:
			"https://www.vectorlogo.zone/logos/datadoghq/datadoghq-ar21.svg",
	},
	// Discord wordmark from official CDN
	{
		name: "Discord",
		slug: "discord",
		wordmarkUrl:
			"https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/67ac9b4644222140ae614b06_Wordmark.svg",
	},
	// Icon-only (no public wordmark CDN available)
	{ name: "Notion", slug: "notion", iconUrl: "https://cdn.simpleicons.org/notion" },
	{ name: "Linear", slug: "linear", iconUrl: "https://cdn.simpleicons.org/linear" },
	{ name: "PostHog", slug: "posthog", iconUrl: "https://cdn.simpleicons.org/posthog" },
	{ name: "Gmail", slug: "gmail", iconUrl: "https://cdn.simpleicons.org/gmail" },
	{
		name: "Google Docs",
		slug: "googledocs",
		iconUrl: "https://cdn.simpleicons.org/googledocs",
	},
	{
		name: "Google Sheets",
		slug: "googlesheets",
		iconUrl: "https://cdn.simpleicons.org/googlesheets",
	},
];

const OUTPUT_DIR = join(process.cwd(), "public", "integrations");

async function downloadLogo(
	integration: Integration,
): Promise<{ content: string; type: "wordmark" | "icon" }> {
	const url = integration.wordmarkUrl || integration.iconUrl;
	if (!url) {
		throw new Error(`No URL configured for ${integration.slug}`);
	}

	const type = integration.wordmarkUrl ? "wordmark" : "icon";
	console.log(`Downloading ${integration.slug} ${type} from ${url}...`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to download ${integration.slug}: ${response.status} ${response.statusText}`,
		);
	}

	let svgContent = await response.text();

	// Replace hardcoded fill colors with currentColor to respect CSS color
	svgContent = svgContent.replace(/fill="[^"]+"/g, 'fill="currentColor"');

	return { content: svgContent, type };
}

async function main() {
	try {
		// Create output directory if it doesn't exist
		await mkdir(OUTPUT_DIR, { recursive: true });
		console.log(`Output directory: ${OUTPUT_DIR}\n`);

		const wordmarks: string[] = [];
		const icons: string[] = [];

		// Download each logo
		for (const integration of integrations) {
			try {
				const { content, type } = await downloadLogo(integration);
				const filename = `${integration.slug}.svg`;
				const filepath = join(OUTPUT_DIR, filename);

				await writeFile(filepath, content, "utf-8");
				console.log(
					`✓ Saved ${integration.name} (${type}) to ${filename}`,
				);

				if (type === "wordmark") {
					wordmarks.push(integration.name);
				} else {
					icons.push(integration.name);
				}
			} catch (error) {
				console.error(`✗ Failed to download ${integration.name}:`, error);
			}
		}

		console.log("\n✓ All logos downloaded successfully!");
		console.log(`\nWordmarks (${wordmarks.length}): ${wordmarks.join(", ")}`);
		console.log(`Icon-only (${icons.length}): ${icons.join(", ")}`);
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
