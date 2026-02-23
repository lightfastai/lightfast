import type { DiscoveredUrl } from "../types.js";
import { extractRootDomain, isSubdomainOf } from "./utils.js";
import { extractSubdomainsFromLinks } from "./sources/link-extraction.js";
import { detectPaths } from "./sources/path-detection.js";
import { discoverFromCtLogs } from "./sources/ct-logs.js";
import { probeCommonPrefixes } from "./sources/common-prefixes.js";

export interface DiscoverOptions {
	htmlLinks?: string[];
	rootUrl?: string;
	networkDomains?: Set<string>;
	discoveryTimeout?: number;
}

// Product-like subdomains ranked higher
const PRODUCT_PREFIXES = new Set([
	"app",
	"dashboard",
	"console",
	"admin",
	"portal",
	"billing",
	"accounts",
]);

/**
 * Main discovery orchestrator.
 * Runs multiple discovery sources, deduplicates, and ranks results.
 */
export async function discover(
	domain: string,
	options: DiscoverOptions = {},
): Promise<DiscoveredUrl[]> {
	const {
		htmlLinks = [],
		rootUrl,
		networkDomains,
		discoveryTimeout = 30_000,
	} = options;

	const rootDomain = extractRootDomain(domain);
	const effectiveRootUrl = rootUrl ?? `https://${domain}`;

	// Phase 1: Run link-extraction (sync) + ct-logs + path-detection in parallel
	const [linkResults, ctResults, pathResults] = await Promise.all([
		Promise.resolve(
			extractSubdomainsFromLinks(htmlLinks, effectiveRootUrl, rootDomain),
		),
		discoverFromCtLogs(rootDomain, discoveryTimeout),
		detectPaths(htmlLinks, effectiveRootUrl, rootDomain),
	]);

	// Collect already-discovered hostnames for phase 2
	const allPhase1 = [...linkResults, ...ctResults, ...pathResults];
	const discoveredHostnames = new Set<string>();
	for (const d of allPhase1) {
		try {
			discoveredHostnames.add(new URL(d.url).hostname);
		} catch {
			// skip
		}
	}

	// Phase 2: Common prefix probes (skip already-found)
	const prefixResults = await probeCommonPrefixes(
		rootDomain,
		discoveredHostnames,
	);

	// Phase 3: Incorporate networkDomains from tier3 browser scan
	const networkResults: DiscoveredUrl[] = [];
	if (networkDomains) {
		for (const nd of networkDomains) {
			if (
				isSubdomainOf(nd, rootDomain) &&
				!discoveredHostnames.has(nd)
			) {
				networkResults.push({
					url: `https://${nd}`,
					source: ["network_request"],
					kind: "subdomain",
					scanned: false,
				});
			}
		}
	}

	// Deduplicate by hostname, merge sources
	const mergedMap = new Map<string, DiscoveredUrl>();
	const allResults = [
		...linkResults,
		...ctResults,
		...pathResults,
		...prefixResults,
		...networkResults,
	];

	for (const item of allResults) {
		let hostname: string;
		try {
			hostname = new URL(item.url).hostname;
		} catch {
			continue;
		}

		const existing = mergedMap.get(hostname);
		if (existing) {
			// Merge sources
			for (const src of item.source) {
				if (!existing.source.includes(src)) {
					existing.source.push(src);
				}
			}
			// Keep the best httpStatus
			if (item.httpStatus && !existing.httpStatus) {
				existing.httpStatus = item.httpStatus;
			}
		} else {
			mergedMap.set(hostname, { ...item });
		}
	}

	// Rank: product-like subdomains first, then others, then paths
	const results = [...mergedMap.values()];
	results.sort((a, b) => {
		// Subdomains before paths
		if (a.kind !== b.kind) {
			return a.kind === "subdomain" ? -1 : 1;
		}

		// Product-like subdomains first
		if (a.kind === "subdomain" && b.kind === "subdomain") {
			const aHost = new URL(a.url).hostname;
			const bHost = new URL(b.url).hostname;
			const aPrefix = aHost.split(".")[0] ?? "";
			const bPrefix = bHost.split(".")[0] ?? "";
			const aProduct = PRODUCT_PREFIXES.has(aPrefix);
			const bProduct = PRODUCT_PREFIXES.has(bPrefix);
			if (aProduct !== bProduct) return aProduct ? -1 : 1;
		}

		// More sources = more confidence
		return b.source.length - a.source.length;
	});

	return results;
}
