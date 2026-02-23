import type { DiscoveredUrl } from "../../types.js";
import { isSubdomainOf } from "../utils.js";

interface CrtShEntry {
	name_value: string;
}

/**
 * Discover subdomains via Certificate Transparency logs (crt.sh).
 * Queries crt.sh for certificates issued to *.rootDomain,
 * extracts hostnames, filters/deduplicates.
 */
export async function discoverFromCtLogs(
	rootDomain: string,
	timeout = 30_000,
): Promise<DiscoveredUrl[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const url = `https://crt.sh/?q=%25.${encodeURIComponent(rootDomain)}&output=json&deduplicate=Y`;
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; TechStackDetector/1.0)",
				Accept: "application/json",
			},
		});

		if (!res.ok) return [];

		const contentType = res.headers.get("content-type") ?? "";
		if (!contentType.includes("json")) return [];

		const entries = (await res.json()) as CrtShEntry[];
		if (!Array.isArray(entries)) return [];
		const seen = new Set<string>();
		const results: DiscoveredUrl[] = [];

		for (const entry of entries) {
			// name_value can contain newline-separated SANs
			const names = entry.name_value.split("\n");
			for (const raw of names) {
				const name = raw.trim().toLowerCase();

				// Skip wildcards and empty
				if (!name || name.startsWith("*")) continue;

				// Must be a subdomain of our root domain
				if (!isSubdomainOf(name, rootDomain)) continue;

				// Validate it looks like a hostname
				if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(name)) continue;

				if (seen.has(name)) continue;
				seen.add(name);

				results.push({
					url: `https://${name}`,
					source: ["ct_log"],
					kind: "subdomain",
					scanned: false,
				});
			}
		}

		return results;
	} catch {
		// Graceful failure — crt.sh can be slow or down
		return [];
	} finally {
		clearTimeout(timer);
	}
}
