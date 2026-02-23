import { describe, expect, it } from "vitest";
import {
	collectKnownDomains,
	collectKnownPatterns,
	findUnmatchedDomains,
} from "./unmatched.js";
import type { ToolSignature } from "./types.js";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const testSignatures: ToolSignature[] = [
	{
		id: "posthog",
		name: "PostHog",
		category: "growth",
		rules: [
			{
				vector: "network_request",
				tier: 3,
				confidence: 0.9,
				domains: ["us.i.posthog.com", "eu.i.posthog.com"],
			},
			{
				vector: "network_request",
				tier: 3,
				confidence: 0.85,
				pattern: /\.posthog\.com/,
			},
		],
	},
	{
		id: "clerk",
		name: "Clerk",
		category: "engineering",
		rules: [
			{
				vector: "network_request",
				tier: 3,
				confidence: 0.85,
				domains: ["clerk.com", "api.clerk.com"],
			},
		],
	},
	{
		id: "sentry",
		name: "Sentry",
		category: "engineering",
		rules: [
			{
				vector: "network_request",
				tier: 3,
				confidence: 0.85,
				domains: ["sentry.io", "ingest.sentry.io"],
			},
			{
				vector: "script_src",
				tier: 1,
				confidence: 0.9,
				pattern: /cdn\.sentry\.io/,
			},
		],
	},
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("collectKnownDomains", () => {
	it("extracts all domains from rules", () => {
		const domains = collectKnownDomains(testSignatures);
		expect(domains).toContain("us.i.posthog.com");
		expect(domains).toContain("eu.i.posthog.com");
		expect(domains).toContain("clerk.com");
		expect(domains).toContain("api.clerk.com");
		expect(domains).toContain("sentry.io");
		expect(domains).toContain("ingest.sentry.io");
	});

	it("returns empty set for signatures with no domain rules", () => {
		const sigs: ToolSignature[] = [
			{
				id: "test",
				name: "Test",
				category: "engineering",
				rules: [{ vector: "header", tier: 1, confidence: 0.9 }],
			},
		];
		expect(collectKnownDomains(sigs).size).toBe(0);
	});
});

describe("collectKnownPatterns", () => {
	it("extracts patterns from network_request and script_src rules", () => {
		const patterns = collectKnownPatterns(testSignatures);
		expect(patterns).toHaveLength(2); // posthog network_request + sentry script_src
	});

	it("ignores patterns from other vectors", () => {
		const sigs: ToolSignature[] = [
			{
				id: "test",
				name: "Test",
				category: "engineering",
				rules: [
					{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /test/ },
				],
			},
		];
		expect(collectKnownPatterns(sigs)).toHaveLength(0);
	});
});

describe("findUnmatchedDomains", () => {
	it("returns unknown domains not in registry", () => {
		const networkDomains = new Set([
			"unknown-tool.com",
			"another-unknown.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).toContain("another-unknown.io");
		expect(result).toContain("unknown-tool.com");
	});

	it("filters target domain and its subdomains", () => {
		const networkDomains = new Set([
			"example.com",
			"www.example.com",
			"api.example.com",
			"cdn.example.com",
			"unknown.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).not.toContain("example.com");
		expect(result).not.toContain("www.example.com");
		expect(result).not.toContain("api.example.com");
		expect(result).not.toContain("cdn.example.com");
		expect(result).toContain("unknown.io");
	});

	it("filters infrastructure domains", () => {
		const networkDomains = new Set([
			"fonts.googleapis.com",
			"cdn.jsdelivr.net",
			"unpkg.com",
			"unknown.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).not.toContain("fonts.googleapis.com");
		expect(result).not.toContain("cdn.jsdelivr.net");
		expect(result).not.toContain("unpkg.com");
		expect(result).toContain("unknown.io");
	});

	it("matches via exact known domain", () => {
		const networkDomains = new Set([
			"clerk.com",
			"sentry.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).not.toContain("clerk.com");
		expect(result).not.toContain("sentry.io");
	});

	it("matches via suffix (subdomain of known domain)", () => {
		const networkDomains = new Set([
			"dashboard.clerk.com",
			"o123456.ingest.sentry.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).not.toContain("dashboard.clerk.com");
		expect(result).not.toContain("o123456.ingest.sentry.io");
	});

	it("matches via reverse root domain lookup", () => {
		// cdn.posthog.com shares root with us.i.posthog.com (known domain)
		const networkDomains = new Set(["cdn.posthog.com"]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).not.toContain("cdn.posthog.com");
	});

	it("matches via regex patterns", () => {
		const networkDomains = new Set([
			"app.posthog.com",
			"cdn.sentry.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).not.toContain("app.posthog.com");
		expect(result).not.toContain("cdn.sentry.io");
	});

	it("returns sorted results", () => {
		const networkDomains = new Set([
			"zebra.io",
			"alpha.com",
			"middle.net",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).toEqual(["alpha.com", "middle.net", "zebra.io"]);
	});

	it("returns empty array when all domains are known", () => {
		const networkDomains = new Set([
			"example.com",
			"clerk.com",
			"sentry.io",
		]);
		const result = findUnmatchedDomains(
			networkDomains,
			"example.com",
			testSignatures,
		);
		expect(result).toEqual([]);
	});

	it("returns empty array for empty input", () => {
		const result = findUnmatchedDomains(
			new Set(),
			"example.com",
			testSignatures,
		);
		expect(result).toEqual([]);
	});
});
