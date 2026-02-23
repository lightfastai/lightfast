// Known two-part TLDs where the "SLD.TLD" is effectively the TLD
const TWO_PART_TLDS = new Set([
	"co.uk",
	"co.jp",
	"co.kr",
	"co.nz",
	"co.za",
	"co.in",
	"com.au",
	"com.br",
	"com.cn",
	"com.mx",
	"com.tw",
	"com.sg",
	"com.hk",
	"org.uk",
	"org.au",
	"net.au",
	"ac.uk",
	"gov.uk",
]);

/**
 * Extract the root domain from a hostname.
 * e.g. "dashboard.clerk.com" → "clerk.com"
 *      "app.posthog.com"     → "posthog.com"
 *      "eu.i.posthog.com"    → "posthog.com"
 *      "api.linear.app"      → "linear.app"
 */
export function extractRootDomain(hostname: string): string {
	const parts = hostname.split(".");
	if (parts.length <= 2) return hostname;

	// Check if last two parts form a known two-part TLD
	const lastTwo = parts.slice(-2).join(".");
	if (TWO_PART_TLDS.has(lastTwo)) {
		return parts.slice(-3).join(".");
	}

	return parts.slice(-2).join(".");
}

/**
 * Check if a hostname is a subdomain of the given root domain.
 * Excludes www. as it's typically the same site.
 */
export function isSubdomainOf(hostname: string, rootDomain: string): boolean {
	const h = hostname.replace(/\.$/, "").toLowerCase();
	const r = rootDomain.replace(/\.$/, "").toLowerCase();
	if (h === r) return false;
	if (h === `www.${r}`) return false;
	return h.endsWith(`.${r}`);
}
