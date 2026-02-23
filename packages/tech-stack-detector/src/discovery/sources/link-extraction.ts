import type { DiscoveredUrl } from "../../types.js";
import { isSubdomainOf } from "../utils.js";

/**
 * Extract subdomains from HTML anchor links found on the page.
 * Filters for same-root-domain subdomains, deduplicates by hostname.
 */
export function extractSubdomainsFromLinks(
	htmlLinks: string[],
	rootUrl: string,
	rootDomain: string,
): DiscoveredUrl[] {
	const seen = new Set<string>();
	const results: DiscoveredUrl[] = [];

	for (const link of htmlLinks) {
		// Skip non-http links
		if (/^(mailto:|tel:|javascript:|#)/.test(link)) continue;

		let hostname: string;
		try {
			const parsed = new URL(link, rootUrl);
			if (parsed.protocol !== "https:" && parsed.protocol !== "http:") continue;
			hostname = parsed.hostname;
		} catch {
			continue;
		}

		if (!isSubdomainOf(hostname, rootDomain)) continue;
		if (seen.has(hostname)) continue;
		seen.add(hostname);

		results.push({
			url: `https://${hostname}`,
			source: ["link_extraction"],
			kind: "subdomain",
			scanned: false,
		});
	}

	return results;
}
