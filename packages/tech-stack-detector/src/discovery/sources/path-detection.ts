import type { DiscoveredUrl } from "../../types.js";

const KNOWN_SAAS_PATHS = new Set([
	"app",
	"dashboard",
	"console",
	"admin",
	"docs",
	"blog",
	"portal",
	"help",
]);

/**
 * Detect microfrontend-style paths from HTML links.
 * Cross-references first path segments against known SaaS paths,
 * then HEAD-probes to confirm they're live.
 */
export async function detectPaths(
	htmlLinks: string[],
	rootUrl: string,
	rootDomain: string,
	timeout = 5_000,
): Promise<DiscoveredUrl[]> {
	const foundSegments = new Set<string>();

	for (const link of htmlLinks) {
		let parsed: URL;
		try {
			parsed = new URL(link, rootUrl);
		} catch {
			continue;
		}

		// Only look at links on the same domain (or www variant)
		const host = parsed.hostname;
		if (host !== rootDomain && host !== `www.${rootDomain}`) continue;

		// Extract first path segment
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length === 0) continue;
		const first = segments[0]?.toLowerCase();
		if (!first) continue;

		if (KNOWN_SAAS_PATHS.has(first)) {
			foundSegments.add(first);
		}
	}

	if (foundSegments.size === 0) return [];

	// HEAD-probe each matched path to confirm it's live
	const probes = [...foundSegments].map(async (segment): Promise<DiscoveredUrl | null> => {
		const probeUrl = `https://${rootDomain}/${segment}`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		try {
			const res = await fetch(probeUrl, {
				method: "HEAD",
				signal: controller.signal,
				redirect: "follow",
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; TechStackDetector/1.0)",
				},
			});

			if ([200, 301, 302, 307, 308].includes(res.status)) {
				return {
					url: probeUrl,
					source: ["path_detection"],
					kind: "path",
					httpStatus: res.status,
					scanned: false,
				};
			}
			return null;
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	});

	const results = await Promise.allSettled(probes);
	return results
		.filter((r): r is PromiseFulfilledResult<DiscoveredUrl | null> => r.status === "fulfilled")
		.map((r) => r.value)
		.filter((v): v is DiscoveredUrl => v !== null);
}
