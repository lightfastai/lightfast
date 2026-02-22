import { detect } from "./pipeline.js";
import type { Category, DetectedTool, DetectionResult } from "./types.js";

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
	const filled = Math.round(confidence * 12);
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

async function main() {
	const args = process.argv.slice(2);
	const flags = new Set(args.filter((a) => a.startsWith("--")));
	const positional = args.filter((a) => !a.startsWith("--"));

	if (positional.length === 0) {
		console.error("Usage: detect <url> [--skip-browser] [--json]");
		process.exit(1);
	}

	const url = positional[0]!;
	const skipBrowser = flags.has("--skip-browser");
	const jsonOutput = flags.has("--json");

	const result = await detect(url, { skipBrowser });

	if (jsonOutput) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(formatTable(result));
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
