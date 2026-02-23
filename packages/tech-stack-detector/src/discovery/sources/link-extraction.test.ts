import { describe, expect, it } from "vitest";

import { extractSubdomainsFromLinks } from "./link-extraction.js";

const ROOT_URL = "https://example.com";
const ROOT_DOMAIN = "example.com";

describe("extractSubdomainsFromLinks", () => {
	it("returns empty array when no links provided", () => {
		const result = extractSubdomainsFromLinks([], ROOT_URL, ROOT_DOMAIN);
		expect(result).toEqual([]);
	});

	it("extracts a valid subdomain link", () => {
		const result = extractSubdomainsFromLinks(
			["https://app.example.com"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(1);
		expect(result[0]?.url).toBe("https://app.example.com");
		expect(result[0]?.source).toEqual(["link_extraction"]);
		expect(result[0]?.kind).toBe("subdomain");
		expect(result[0]?.scanned).toBe(false);
	});

	it("extracts multiple distinct subdomains", () => {
		const result = extractSubdomainsFromLinks(
			["https://app.example.com", "https://api.example.com"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(2);
		const urls = result.map((r) => r.url);
		expect(urls).toContain("https://app.example.com");
		expect(urls).toContain("https://api.example.com");
	});

	it("deduplicates links pointing to the same subdomain", () => {
		const result = extractSubdomainsFromLinks(
			[
				"https://app.example.com/dashboard",
				"https://app.example.com/settings",
				"https://app.example.com",
			],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		// All three resolve to the same hostname — should deduplicate to 1
		expect(result).toHaveLength(1);
		expect(result[0]?.url).toBe("https://app.example.com");
	});

	it("filters out links to the root domain itself", () => {
		const result = extractSubdomainsFromLinks(
			["https://example.com/about"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("filters out links to www subdomain", () => {
		const result = extractSubdomainsFromLinks(
			["https://www.example.com"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		// www is excluded by isSubdomainOf
		expect(result).toHaveLength(0);
	});

	it("filters out links to completely different domains", () => {
		const result = extractSubdomainsFromLinks(
			["https://other.com/page"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("skips mailto: links", () => {
		const result = extractSubdomainsFromLinks(
			["mailto:support@app.example.com"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("skips tel: links", () => {
		const result = extractSubdomainsFromLinks(
			["tel:+1-800-555-0000"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("skips javascript: links", () => {
		const result = extractSubdomainsFromLinks(
			["javascript:void(0)"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("skips fragment-only links", () => {
		const result = extractSubdomainsFromLinks(
			["#top", "#section"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("resolves relative links against rootUrl", () => {
		// A relative path like "/app" resolves to example.com — not a subdomain
		const result = extractSubdomainsFromLinks(
			["/about", "/contact"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(0);
	});

	it("handles http:// subdomain links in addition to https://", () => {
		const result = extractSubdomainsFromLinks(
			["http://app.example.com"],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		// http is accepted by the link-extraction source
		expect(result).toHaveLength(1);
		expect(result[0]?.url).toBe("https://app.example.com");
	});

	it("mixed valid and invalid links — only returns valid subdomains", () => {
		const result = extractSubdomainsFromLinks(
			[
				"mailto:info@example.com",
				"https://app.example.com",
				"https://other.com",
				"https://api.example.com",
				"#skip",
			],
			ROOT_URL,
			ROOT_DOMAIN,
		);
		expect(result).toHaveLength(2);
		const urls = result.map((r) => r.url);
		expect(urls).toContain("https://app.example.com");
		expect(urls).toContain("https://api.example.com");
	});
});
