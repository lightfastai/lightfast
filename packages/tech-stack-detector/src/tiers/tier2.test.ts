import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runTier2 } from "./tier2.js";
import type { ToolSignature } from "../types.js";

// Mock the dns/promises module before any imports resolve
vi.mock("node:dns/promises", () => ({
	default: {
		resolveCname: vi.fn(),
		resolveTxt: vi.fn(),
		resolve4: vi.fn(),
	},
}));

function makeSig(id: string, rules: ToolSignature["rules"]): ToolSignature {
	return { id, name: id, category: "engineering", rules };
}

// ─── Helpers to control DNS responses ────────────────────────────────────────

async function setupDns(overrides: {
	cnames?: string[];
	txt?: string[][];
	a?: string[];
	robots?: string;
}) {
	const dns = (await import("node:dns/promises")).default;

	vi.mocked(dns.resolveCname).mockResolvedValue(overrides.cnames ?? []);
	vi.mocked(dns.resolveTxt).mockResolvedValue(overrides.txt ?? []);
	vi.mocked(dns.resolve4).mockResolvedValue(overrides.a ?? []);

	// Mock global fetch for robots.txt
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: !!overrides.robots,
			text: () => overrides.robots ?? "",
		}),
	);
}

describe("runTier2", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe("dns_cname vector", () => {
		it("matches a CNAME record against a pattern", async () => {
			await setupDns({ cnames: ["example.vercel.app"] });

			const sig = makeSig("vercel", [
				{
					vector: "dns_cname",
					tier: 2,
					confidence: 0.9,
					pattern: /vercel[-.]dns|\.vercel\.app/i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.toolId).toBe("vercel");
			expect(matches[0]?.vector).toBe("dns_cname");
			expect(matches[0]?.evidence).toBe("CNAME example.vercel.app");
		});

		it("does not match when CNAME does not satisfy pattern", async () => {
			await setupDns({ cnames: ["other.host.com"] });

			const sig = makeSig("vercel", [
				{
					vector: "dns_cname",
					tier: 2,
					confidence: 0.9,
					pattern: /\.vercel\.app/i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(0);
		});

		it("returns no matches when CNAME list is empty", async () => {
			await setupDns({ cnames: [] });

			const sig = makeSig("netlify", [
				{
					vector: "dns_cname",
					tier: 2,
					confidence: 0.9,
					pattern: /netlify/i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("dns_txt vector", () => {
		it("matches a TXT record via pattern", async () => {
			await setupDns({ txt: [["v=spf1 include:sendgrid.net ~all"]] });

			const sig = makeSig("sendgrid", [
				{
					vector: "dns_txt",
					tier: 2,
					confidence: 0.7,
					pattern: /sendgrid/i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toContain("TXT ");
			expect(matches[0]?.evidence).toContain("sendgrid");
		});

		it("joins multi-string TXT records before matching", async () => {
			// TXT records can be split into multiple strings; they should be joined
			await setupDns({ txt: [["google-site-verification=", "abc123xyz"]] });

			const sig = makeSig("google", [
				{
					vector: "dns_txt",
					tier: 2,
					confidence: 0.6,
					pattern: /google-site-verification/,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(1);
		});

		it("truncates evidence to 60 chars", async () => {
			const longRecord = "v=spf1 " + "a ".repeat(40);
			await setupDns({ txt: [[longRecord]] });

			const sig = makeSig("tool", [
				{
					vector: "dns_txt",
					tier: 2,
					confidence: 0.5,
					pattern: /v=spf1/,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches[0]?.evidence.length).toBeLessThanOrEqual("TXT ".length + 60);
		});
	});

	describe("dns_a vector", () => {
		it("matches an A record IP via pattern", async () => {
			await setupDns({ a: ["76.76.21.21"] });

			const sig = makeSig("vercel", [
				{
					vector: "dns_a",
					tier: 2,
					confidence: 0.7,
					pattern: /^76\.76\./,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toBe("A 76.76.21.21");
		});

		it("does not match when IP pattern does not match", async () => {
			await setupDns({ a: ["1.2.3.4"] });

			const sig = makeSig("vercel", [
				{
					vector: "dns_a",
					tier: 2,
					confidence: 0.7,
					pattern: /^76\.76\./,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("robots_txt vector", () => {
		it("matches robots.txt content via pattern", async () => {
			await setupDns({
				robots: "User-agent: *\nDisallow: /wp-admin/\nAllow: /",
			});

			const sig = makeSig("wordpress", [
				{
					vector: "robots_txt",
					tier: 2,
					confidence: 0.8,
					pattern: /\/wp-admin\//i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toBe("robots.txt match");
		});

		it("does not match when robots.txt content does not satisfy pattern", async () => {
			await setupDns({ robots: "User-agent: *\nDisallow: /private/" });

			const sig = makeSig("wordpress", [
				{
					vector: "robots_txt",
					tier: 2,
					confidence: 0.8,
					pattern: /\/wp-admin\//i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(0);
		});

		it("handles fetch failure gracefully (empty robots.txt)", async () => {
			const dns = (await import("node:dns/promises")).default;
			vi.mocked(dns.resolveCname).mockResolvedValue([]);
			vi.mocked(dns.resolveTxt).mockResolvedValue([]);
			vi.mocked(dns.resolve4).mockResolvedValue([]);

			// Simulate a fetch failure
			vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

			const sig = makeSig("wordpress", [
				{
					vector: "robots_txt",
					tier: 2,
					confidence: 0.8,
					pattern: /\/wp-admin\//i,
				},
			]);

			// Should not throw; just return no matches
			await expect(runTier2("https://example.com", [sig])).resolves.toEqual([]);
		});
	});

	describe("tier filtering", () => {
		it("only processes tier 2 rules, skips tier 1 rules", async () => {
			await setupDns({ cnames: ["example.vercel.app"] });

			const sig = makeSig("vercel", [
				{
					vector: "dns_cname",
					tier: 1, // wrong tier — should be ignored
					confidence: 0.9,
					pattern: /vercel/i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("multiple signals", () => {
		it("returns a match per tool per matching record", async () => {
			await setupDns({
				cnames: ["mysite.netlify.app"],
				robots: "# Netlify",
			});

			const sig = makeSig("netlify", [
				{
					vector: "dns_cname",
					tier: 2,
					confidence: 0.9,
					pattern: /netlify/i,
				},
				{
					vector: "robots_txt",
					tier: 2,
					confidence: 0.6,
					pattern: /netlify/i,
				},
			]);

			const matches = await runTier2("https://example.com", [sig]);
			expect(matches).toHaveLength(2);
			const vectors = matches.map((m) => m.vector);
			expect(vectors).toContain("dns_cname");
			expect(vectors).toContain("robots_txt");
		});
	});
});
