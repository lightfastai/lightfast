import type { DiscoveredUrl } from "../../types.js";

const COMMON_PREFIXES = [
	"app",
	"dashboard",
	"docs",
	"api",
	"admin",
	"console",
	"portal",
	"status",
	"blog",
	"help",
	"support",
	"billing",
	"accounts",
	"login",
	"auth",
];

/**
 * HEAD-probe common subdomain prefixes to discover live subdomains.
 * Skips prefixes already discovered by other sources.
 */
export async function probeCommonPrefixes(
	rootDomain: string,
	alreadyDiscovered = new Set<string>(),
	timeout = 5_000,
): Promise<DiscoveredUrl[]> {
	rootDomain = rootDomain.toLowerCase();
	const probes = COMMON_PREFIXES
		.filter((prefix) => !alreadyDiscovered.has(`${prefix}.${rootDomain}`))
		.map(async (prefix): Promise<DiscoveredUrl | null> => {
			const hostname = `${prefix}.${rootDomain}`;
			const probeUrl = `https://${hostname}`;
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeout);

			try {
				const res = await fetch(probeUrl, {
					method: "HEAD",
					signal: controller.signal,
					redirect: "manual",
					headers: {
						"User-Agent": "Mozilla/5.0 (compatible; TechStackDetector/1.0)",
					},
				});

				if ([200, 301, 302, 307, 308].includes(res.status)) {
					return {
						url: probeUrl,
						source: ["common_prefix"],
						kind: "subdomain",
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
