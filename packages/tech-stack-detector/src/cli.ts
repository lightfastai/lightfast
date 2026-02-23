import { detect } from "./pipeline.js";
import { deepDetect } from "./deep-detect.js";
import { discover } from "./discovery/index.js";
import { extractRootDomain } from "./discovery/utils.js";
import { fetchAndParse } from "./tiers/tier1.js";
import type {
	Category,
	DeepDetectionResult,
	DetectedTool,
	DetectionResult,
	DiscoveredUrl,
} from "./types.js";

const CATEGORY_ORDER: Category[] = [
	"engineering",
	"customer",
	"revenue",
	"growth",
	"communication",
];

const CATEGORY_LABELS: Record<Category, string> = {
	engineering: "ENGINEERING",
	customer: "CUSTOMER",
	revenue: "REVENUE",
	growth: "GROWTH",
	communication: "COMMUNICATION",
};

function renderBar(confidence: number): string {
	const clamped = Math.max(0, Math.min(1, confidence));
	const filled = Math.round(clamped * 12);
	return "\u2588".repeat(filled) + "\u2591".repeat(12 - filled);
}

function formatTable(result: DetectionResult): string {
	const lines: string[] = [];
	const tierLabel = result.tiersUsed.includes(3) ? "Tiers 1+2+3" : "Tiers 1+2";

	lines.push("");
	lines.push(
		`  ${result.domain} \u2014 Tech Stack Analysis (${result.durationMs}ms, ${tierLabel})`,
	);
	lines.push("");

	// Group by category
	const byCategory = new Map<Category, DetectedTool[]>();
	for (const tool of result.detected) {
		const list = byCategory.get(tool.category) ?? [];
		list.push(tool);
		byCategory.set(tool.category, list);
	}

	for (const cat of CATEGORY_ORDER) {
		const tools = byCategory.get(cat);
		if (!tools || tools.length === 0) continue;

		lines.push(`  ${CATEGORY_LABELS[cat]}`);
		for (const tool of tools) {
			const bar = renderBar(tool.confidence);
			const evidence = tool.signals
				.map((s) => s.evidence)
				.filter(Boolean)
				.slice(0, 3)
				.join(", ");
			const name = tool.name.padEnd(16);
			lines.push(
				`    ${name}${bar} ${tool.confidence.toFixed(2)}  ${evidence}`,
			);
		}
		lines.push("");
	}

	const warnings = result.detected.filter((t) => t.level === "possible").length;
	lines.push(
		`  ${result.totalChecked} tools checked \u00b7 ${result.detected.length} detected \u00b7 ${warnings} warnings`,
	);
	lines.push("");

	return lines.join("\n");
}

function formatDiscoveredTable(discovered: DiscoveredUrl[]): string {
	const lines: string[] = [];

	lines.push("");
	lines.push("  DISCOVERED URLS");
	lines.push("  " + "\u2500".repeat(70));

	if (discovered.length === 0) {
		lines.push("    No subdomains or paths discovered");
	} else {
		for (const d of discovered) {
			const status = d.httpStatus ? `[${d.httpStatus}]` : "     ";
			const sources = d.source.join(", ");
			const scanned = d.scanned ? "\u2713" : " ";
			const url = d.url.padEnd(40);
			lines.push(`    ${scanned} ${status} ${url} ${d.kind.padEnd(10)} (${sources})`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

function formatDeepResult(result: DeepDetectionResult): string {
	const lines: string[] = [];

	// Primary result
	lines.push(formatTable(result.primary));

	// Discovered URLs
	lines.push(formatDiscoveredTable(result.discovered));

	// Sub-results
	if (result.subResults.length > 0) {
		for (const sub of result.subResults) {
			lines.push("  " + "\u2500".repeat(70));
			lines.push(formatTable(sub));
		}
	}

	// Summary
	lines.push("  " + "\u2550".repeat(70));
	lines.push("");
	const primaryCount = result.primary.detected.length;
	const subCounts = result.subResults.map(
		(s) => `${s.domain}: ${s.detected.length} tools`,
	);
	const summaryParts = [
		`Root: ${primaryCount} tools`,
		...subCounts,
		`Total unique: ${result.allDetected.length} tools`,
	];
	lines.push(`  ${summaryParts.join(" | ")}`);
	lines.push(`  Total duration: ${result.totalDurationMs}ms`);
	lines.push("");

	return lines.join("\n");
}

function parseMaxScans(args: string[]): number | undefined {
	const idx = args.indexOf("--max-scans");
	if (idx === -1 || idx + 1 >= args.length) return undefined;
	const val = parseInt(args[idx + 1] ?? "", 10);
	return Number.isNaN(val) ? undefined : val;
}

async function main() {
	const args = process.argv.slice(2);
	const flags = new Set(args.filter((a) => a.startsWith("--")));
	const positional = args.filter((a) => !a.startsWith("--") && !isMaxScansValue(args, a));

	if (positional.length === 0) {
		console.error(
			"Usage: detect <url> [--skip-browser] [--json] [--deep] [--discover-only] [--max-scans <n>]",
		);
		process.exit(1);
	}

	const url = positional[0] ?? "";
	const skipBrowser = flags.has("--skip-browser");
	const jsonOutput = flags.has("--json");
	const deepMode = flags.has("--deep");
	const discoverOnly = flags.has("--discover-only");
	const maxScans = parseMaxScans(args);

	if (discoverOnly) {
		// Discovery-only mode: fetch HTML, run discovery, print results
		const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
		const domain = new URL(normalizedUrl).hostname;
		const rootDomain = extractRootDomain(domain);

		const fetchResult = await fetchAndParse(normalizedUrl);
		const htmlLinks = fetchResult?.data.htmlLinks ?? [];

		const discovered = await discover(domain, {
			htmlLinks,
			rootUrl: normalizedUrl,
		});

		if (jsonOutput) {
			console.log(JSON.stringify({ url: normalizedUrl, domain, rootDomain, discovered }, null, 2));
		} else {
			console.log(`\n  Discovery for ${domain} (root: ${rootDomain})`);
			console.log(formatDiscoveredTable(discovered));
			console.log(`  ${discovered.length} URLs discovered`);
			console.log("");
		}
		return;
	}

	if (deepMode) {
		const result = await deepDetect(url, {
			skipBrowser,
			deep: true,
			maxDeepScans: maxScans ?? 5,
		});

		if (jsonOutput) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(formatDeepResult(result));
		}
		return;
	}

	// Standard detection (unchanged behavior)
	const result = await detect(url, { skipBrowser });

	if (jsonOutput) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(formatTable(result));
	}
}

/** Check if a value is the argument to --max-scans */
function isMaxScansValue(args: string[], value: string): boolean {
	const idx = args.indexOf(value);
	return idx > 0 && args[idx - 1] === "--max-scans";
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
