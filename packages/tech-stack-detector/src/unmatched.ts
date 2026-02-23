import { SIGNATURES } from "./registry.js";
import { extractRootDomain } from "./discovery/utils.js";
import type { ToolSignature } from "./types.js";

/**
 * Infrastructure domains that appear on most sites and are not third-party tools.
 * These are generic CDNs, font services, and browser infrastructure.
 */
const INFRASTRUCTURE_DOMAINS = new Set([
	// Google infrastructure (NOT analytics/GTM — those are registry-detected tools)
	"fonts.googleapis.com",
	"fonts.gstatic.com",
	"www.gstatic.com",
	"apis.google.com",
	"www.google.com",
	"pagead2.googlesyndication.com",
	"adservice.google.com",
	"translate.googleapis.com",
	"maps.googleapis.com",
	"maps.gstatic.com",
	// Generic CDNs
	"cdn.jsdelivr.net",
	"unpkg.com",
	"cdnjs.cloudflare.com",
	"ajax.googleapis.com",
	"cdn.cloudflare.com",
	// Browser / standards
	"localhost",
	"accounts.google.com",
	"play.google.com",
	// Common image/media CDNs
	"i.imgur.com",
	"images.unsplash.com",
]);

/**
 * Extracts all `domains[]` entries from all rules across all signatures into a Set.
 */
export function collectKnownDomains(sigs: ToolSignature[]): Set<string> {
	const known = new Set<string>();
	for (const sig of sigs) {
		for (const rule of sig.rules) {
			if (rule.domains) {
				for (const d of rule.domains) {
					known.add(d);
				}
			}
		}
	}
	return known;
}

/**
 * Extracts `pattern` regexes from `network_request` and `script_src` rules.
 */
export function collectKnownPatterns(sigs: ToolSignature[]): RegExp[] {
	const patterns: RegExp[] = [];
	for (const sig of sigs) {
		for (const rule of sig.rules) {
			if (
				(rule.vector === "network_request" || rule.vector === "script_src") &&
				rule.pattern
			) {
				patterns.push(rule.pattern);
			}
		}
	}
	return patterns;
}

/**
 * Finds domains observed during a browser scan that have no match in the registry.
 *
 * Filters out:
 * - Target domain and its subdomains
 * - Infrastructure domains (static allowlist)
 * - Domains matching known registry domains (exact + suffix match)
 * - Domains matching known registry patterns
 *
 * @returns Sorted array of unmatched domain strings
 */
export function findUnmatchedDomains(
	networkDomains: Set<string>,
	targetDomain: string,
	sigs: ToolSignature[] = SIGNATURES,
): string[] {
	const targetRoot = extractRootDomain(targetDomain);
	const knownDomains = collectKnownDomains(sigs);
	const knownPatterns = collectKnownPatterns(sigs);

	const unmatched: string[] = [];

	for (const domain of networkDomains) {
		// Skip target domain and its subdomains
		const domainRoot = extractRootDomain(domain);
		if (domainRoot === targetRoot) continue;

		// Skip infrastructure domains
		if (INFRASTRUCTURE_DOMAINS.has(domain)) continue;

		// Check exact match against known registry domains
		if (knownDomains.has(domain)) continue;

		// Check suffix match (domain is a subdomain of a known domain)
		let suffixMatched = false;
		for (const known of knownDomains) {
			if (domain.endsWith(`.${known}`)) {
				suffixMatched = true;
				break;
			}
		}
		if (suffixMatched) continue;

		// Check if known domain is a subdomain of this domain's root
		let reverseMatched = false;
		for (const known of knownDomains) {
			if (extractRootDomain(known) === domainRoot) {
				reverseMatched = true;
				break;
			}
		}
		if (reverseMatched) continue;

		// Check against known patterns
		let patternMatched = false;
		for (const pattern of knownPatterns) {
			if (pattern.test(domain) || pattern.test(`https://${domain}/`)) {
				patternMatched = true;
				break;
			}
		}
		if (patternMatched) continue;

		unmatched.push(domain);
	}

	return unmatched.sort();
}
