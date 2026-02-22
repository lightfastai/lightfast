import { SIGNATURES } from "./registry.js";
import { computeConfidence, confidenceLevel } from "./scoring.js";
import { runTier1 } from "./tiers/tier1.js";
import { runTier2 } from "./tiers/tier2.js";
import { runTier3 } from "./tiers/tier3.js";
import type {
	DetectOptions,
	DetectedTool,
	DetectionResult,
	RuleMatch,
	Tier,
} from "./types.js";

export async function detect(
	url: string,
	options: DetectOptions = {},
): Promise<DetectionResult> {
	const start = performance.now();
	const { skipBrowser = false, timeout = 10_000 } = options;

	// Normalize URL
	if (!url.startsWith("http")) {
		url = `https://${url}`;
	}

	const domain = new URL(url).hostname;
	const tiersUsed: Tier[] = [1, 2];

	// Tier 1 + Tier 2 run in parallel
	const [tier1Matches, tier2Matches] = await Promise.all([
		runTier1(url, SIGNATURES, timeout),
		runTier2(url, SIGNATURES),
	]);

	// Tier 3 runs after (headless browser)
	let tier3Matches: RuleMatch[] = [];
	if (!skipBrowser) {
		tiersUsed.push(3);
		tier3Matches = await runTier3(url, SIGNATURES, 15_000);
	}

	// Group all matches by toolId
	const allMatches = [...tier1Matches, ...tier2Matches, ...tier3Matches];
	const matchesByTool = new Map<string, RuleMatch[]>();
	for (const match of allMatches) {
		const list = matchesByTool.get(match.toolId) ?? [];
		list.push(match);
		matchesByTool.set(match.toolId, list);
	}

	// Score each tool
	const detected: DetectedTool[] = [];
	for (const sig of SIGNATURES) {
		const signals = matchesByTool.get(sig.id);
		if (!signals || signals.length === 0) continue;

		const score = computeConfidence(signals);
		if (score >= 0.3) {
			detected.push({
				id: sig.id,
				name: sig.name,
				category: sig.category,
				confidence: Math.round(score * 100) / 100,
				level: confidenceLevel(score),
				signals,
			});
		}
	}

	// Sort by confidence descending
	detected.sort((a, b) => b.confidence - a.confidence);

	return {
		url,
		domain,
		detected,
		totalChecked: SIGNATURES.length,
		tiersUsed,
		durationMs: Math.round(performance.now() - start),
	};
}
