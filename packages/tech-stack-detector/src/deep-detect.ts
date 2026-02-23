import { SIGNATURES } from "./registry.js";
import { computeConfidence, confidenceLevel } from "./scoring.js";
import { fetchAndParse, matchTier1Rules } from "./tiers/tier1.js";
import { runTier2 } from "./tiers/tier2.js";
import { runTier3 } from "./tiers/tier3.js";
import { discover } from "./discovery/index.js";
import { detect } from "./pipeline.js";
import type {
	DeepDetectOptions,
	DeepDetectionResult,
	DetectedTool,
	DetectionResult,
	RuleMatch,
	Tier,
} from "./types.js";

const MAX_CONCURRENT_SCANS = 3;

async function runConcurrent<T>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<void>,
): Promise<void> {
	const queue = [...items];
	const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			if (!item) break;
			await fn(item);
		}
	});
	await Promise.all(workers);
}

function mergeDetectedTools(allResults: DetectionResult[]): DetectedTool[] {
	const toolMap = new Map<string, { signals: RuleMatch[]; name: string; category: DetectedTool["category"] }>();

	for (const result of allResults) {
		for (const tool of result.detected) {
			const existing = toolMap.get(tool.id);
			if (existing) {
				// Merge signals, avoiding exact duplicates
				for (const sig of tool.signals) {
					const isDupe = existing.signals.some(
						(s) =>
							s.vector === sig.vector &&
							s.tier === sig.tier &&
							s.evidence === sig.evidence,
					);
					if (!isDupe) {
						existing.signals.push(sig);
					}
				}
			} else {
				toolMap.set(tool.id, {
					signals: [...tool.signals],
					name: tool.name,
					category: tool.category,
				});
			}
		}
	}

	const merged: DetectedTool[] = [];
	for (const [id, data] of toolMap) {
		const score = computeConfidence(data.signals);
		if (score >= 0.3) {
			merged.push({
				id,
				name: data.name,
				category: data.category,
				confidence: Math.round(score * 100) / 100,
				level: confidenceLevel(score),
				signals: data.signals,
			});
		}
	}

	merged.sort((a, b) => b.confidence - a.confidence);
	return merged;
}

export async function deepDetect(
	url: string,
	options: DeepDetectOptions = {},
): Promise<DeepDetectionResult> {
	const totalStart = performance.now();
	const {
		skipBrowser = false,
		timeout = 10_000,
		deep = true,
		maxDeepScans = 5,
		discoveryTimeout = 30_000,
	} = options;

	// Normalize URL
	if (!url.startsWith("http")) {
		url = `https://${url}`;
	}

	const domain = new URL(url).hostname;
	const start = performance.now();
	const tiersUsed: Tier[] = [1, 2];

	// Step 1: fetchAndParse to get HTML for both tier1 matching and link extraction
	const fetchResult = await fetchAndParse(url, timeout);
	const tier1Matches = fetchResult
		? matchTier1Rules(fetchResult.data, fetchResult.targetHostname, SIGNATURES)
		: [];
	const htmlLinks = fetchResult?.data.htmlLinks ?? [];

	// Step 2: Parallel — tier2 + discovery
	const [tier2Matches, discovered] = await Promise.all([
		runTier2(url, SIGNATURES),
		discover(domain, {
			htmlLinks,
			rootUrl: url,
			discoveryTimeout,
		}),
	]);

	// Step 3: Tier 3 (browser) on root
	let tier3Matches: RuleMatch[] = [];
	let networkDomains = new Set<string>();
	if (!skipBrowser) {
		tiersUsed.push(3);
		const tier3Result = await runTier3(url, SIGNATURES, 15_000);
		tier3Matches = tier3Result.matches;
		networkDomains = tier3Result.networkDomains;
	}

	// Feed networkDomains back into discovery for additional subdomains
	if (networkDomains.size > 0) {
		const networkDiscovered = await discover(domain, {
			networkDomains,
			discoveryTimeout: 5_000,
		});

		// Merge network-discovered URLs
		const existingUrls = new Set(discovered.map((d) => {
			try { return new URL(d.url).hostname; } catch { return ""; }
		}));

		for (const nd of networkDiscovered) {
			try {
				const host = new URL(nd.url).hostname;
				if (!existingUrls.has(host)) {
					discovered.push(nd);
					existingUrls.add(host);
				}
			} catch {
				// skip
			}
		}
	}

	// Build primary result
	const allPrimaryMatches = [...tier1Matches, ...tier2Matches, ...tier3Matches];
	const matchesByTool = new Map<string, RuleMatch[]>();
	for (const match of allPrimaryMatches) {
		const list = matchesByTool.get(match.toolId) ?? [];
		list.push(match);
		matchesByTool.set(match.toolId, list);
	}

	const primaryDetected: DetectedTool[] = [];
	for (const sig of SIGNATURES) {
		const signals = matchesByTool.get(sig.id);
		if (!signals || signals.length === 0) continue;
		const score = computeConfidence(signals);
		if (score >= 0.3) {
			primaryDetected.push({
				id: sig.id,
				name: sig.name,
				category: sig.category,
				confidence: Math.round(score * 100) / 100,
				level: confidenceLevel(score),
				signals,
			});
		}
	}
	primaryDetected.sort((a, b) => b.confidence - a.confidence);

	const primary: DetectionResult = {
		url,
		domain,
		detected: primaryDetected,
		totalChecked: SIGNATURES.length,
		tiersUsed,
		durationMs: Math.round(performance.now() - start),
	};

	// Step 4: If deep mode, scan top N discovered URLs
	const subResults: DetectionResult[] = [];
	if (deep && discovered.length > 0) {
		const toScan = discovered.slice(0, maxDeepScans);

		await runConcurrent(toScan, MAX_CONCURRENT_SCANS, async (item) => {
			try {
				const result = await detect(item.url, { skipBrowser, timeout });
				item.scanned = true;
				subResults.push(result);
			} catch (err) {
				console.error(`[deep] failed to scan ${item.url}: ${(err as Error).message}`);
			}
		});
	}

	// Step 5: Merge all detected tools across all results
	const allDetected = mergeDetectedTools([primary, ...subResults]);

	return {
		primary,
		discovered,
		subResults,
		allDetected,
		totalDurationMs: Math.round(performance.now() - totalStart),
	};
}
