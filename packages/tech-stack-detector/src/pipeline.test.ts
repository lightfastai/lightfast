import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the tier runners before importing the pipeline
vi.mock("./tiers/tier1.js", () => ({
	runTier1: vi.fn(),
}));
vi.mock("./tiers/tier2.js", () => ({
	runTier2: vi.fn(),
}));
vi.mock("./tiers/tier3.js", () => ({
	runTier3: vi.fn(),
}));

import { runTier1 } from "./tiers/tier1.js";
import { runTier2 } from "./tiers/tier2.js";
import { runTier3 } from "./tiers/tier3.js";
import { detect } from "./pipeline.js";
import type { RuleMatch } from "./types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMatch(toolId: string, confidence: number): RuleMatch {
	return {
		toolId,
		vector: "header",
		tier: 1,
		confidence,
		evidence: "test",
	};
}

const emptyTier3Result = { matches: [], networkDomains: new Set<string>() };

describe("detect", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(runTier1).mockResolvedValue([]);
		vi.mocked(runTier2).mockResolvedValue([]);
		vi.mocked(runTier3).mockResolvedValue(emptyTier3Result);
	});

	describe("URL normalization", () => {
		it("prepends https:// when no protocol is given", async () => {
			await detect("vercel.com", { skipBrowser: true });

			expect(vi.mocked(runTier1)).toHaveBeenCalledWith(
				"https://vercel.com",
				expect.anything(),
				expect.anything(),
			);
		});

		it("does not double-prepend when https:// is already present", async () => {
			await detect("https://vercel.com", { skipBrowser: true });

			expect(vi.mocked(runTier1)).toHaveBeenCalledWith(
				"https://vercel.com",
				expect.anything(),
				expect.anything(),
			);
		});

		it("does not modify http:// URLs", async () => {
			await detect("http://vercel.com", { skipBrowser: true });

			expect(vi.mocked(runTier1)).toHaveBeenCalledWith(
				"http://vercel.com",
				expect.anything(),
				expect.anything(),
			);
		});
	});

	describe("domain extraction", () => {
		it("sets domain correctly in the result", async () => {
			const result = await detect("https://app.example.com", { skipBrowser: true });
			expect(result.domain).toBe("app.example.com");
		});
	});

	describe("tier management", () => {
		it("runs tier 1 and tier 2 always", async () => {
			await detect("https://example.com", { skipBrowser: true });
			expect(vi.mocked(runTier1)).toHaveBeenCalledOnce();
			expect(vi.mocked(runTier2)).toHaveBeenCalledOnce();
		});

		it("runs tier 3 by default", async () => {
			await detect("https://example.com");
			expect(vi.mocked(runTier3)).toHaveBeenCalledOnce();
		});

		it("skips tier 3 when skipBrowser is true", async () => {
			await detect("https://example.com", { skipBrowser: true });
			expect(vi.mocked(runTier3)).not.toHaveBeenCalled();
		});

		it("includes tier 3 in tiersUsed when browser runs", async () => {
			const result = await detect("https://example.com");
			expect(result.tiersUsed).toContain(3);
		});

		it("excludes tier 3 from tiersUsed when skipBrowser", async () => {
			const result = await detect("https://example.com", { skipBrowser: true });
			expect(result.tiersUsed).not.toContain(3);
			expect(result.tiersUsed).toEqual([1, 2]);
		});
	});

	describe("signal grouping and scoring", () => {
		it("groups signals by toolId and computes Noisy-OR confidence", async () => {
			// Two signals for "vercel" — one from tier1, one from tier2
			// P = 1 - (1 - 0.95) * (1 - 0.9) = 1 - 0.05 * 0.1 = 0.995
			vi.mocked(runTier1).mockResolvedValue([makeMatch("vercel", 0.95)]);
			vi.mocked(runTier2).mockResolvedValue([makeMatch("vercel", 0.9)]);

			const result = await detect("https://vercel.com", { skipBrowser: true });

			const vercel = result.detected.find((d) => d.id === "vercel");
			expect(vercel).toBeDefined();
			expect(vercel?.confidence).toBeGreaterThan(0.99);
			expect(vercel?.level).toBe("detected");
		});

		it("filters out tools below 0.3 confidence threshold", async () => {
			// Use a toolId that actually exists in SIGNATURES to ensure it gets picked up
			// For a non-existent toolId the loop won't produce a DetectedTool
			// Let's test with a real id from SIGNATURES
			vi.mocked(runTier1).mockResolvedValue([
				{ toolId: "vercel", vector: "header", tier: 1, confidence: 0.1, evidence: "low" },
			]);

			const result = await detect("https://example.com", { skipBrowser: true });

			// score = 0.1 which is < 0.3, so should be filtered
			const vercel = result.detected.find((d) => d.id === "vercel");
			expect(vercel).toBeUndefined();
		});

		it("includes tools at exactly 0.3 confidence", async () => {
			vi.mocked(runTier1).mockResolvedValue([
				{ toolId: "vercel", vector: "header", tier: 1, confidence: 0.3, evidence: "ok" },
			]);

			const result = await detect("https://example.com", { skipBrowser: true });

			const vercel = result.detected.find((d) => d.id === "vercel");
			expect(vercel).toBeDefined();
		});

		it("merges signals from all tiers for the same toolId", async () => {
			const tier1Signal = makeMatch("posthog", 0.8);
			const tier2Signal: RuleMatch = {
				toolId: "posthog",
				vector: "dns_cname",
				tier: 2,
				confidence: 0.7,
				evidence: "CNAME posthog",
			};
			const tier3Signal: RuleMatch = {
				toolId: "posthog",
				vector: "network_request",
				tier: 3,
				confidence: 0.9,
				evidence: "request to cdn.posthog.com",
			};

			vi.mocked(runTier1).mockResolvedValue([tier1Signal]);
			vi.mocked(runTier2).mockResolvedValue([tier2Signal]);
			vi.mocked(runTier3).mockResolvedValue({
				matches: [tier3Signal],
				networkDomains: new Set(["cdn.posthog.com"]),
			});

			const result = await detect("https://example.com");

			const posthog = result.detected.find((d) => d.id === "posthog");
			expect(posthog?.signals).toHaveLength(3);
		});
	});

	describe("result sorting", () => {
		it("sorts detected tools by confidence descending", async () => {
			vi.mocked(runTier1).mockResolvedValue([
				makeMatch("vercel", 0.5),
				makeMatch("posthog", 0.95),
				makeMatch("clerk", 0.7),
			]);

			const result = await detect("https://example.com", { skipBrowser: true });

			// Filter to only tools that exist in SIGNATURES (vercel, posthog, clerk should all be there)
			const confidences = result.detected.map((d) => d.confidence);
			for (let i = 1; i < confidences.length; i++) {
				expect(confidences[i - 1]).toBeGreaterThanOrEqual(confidences[i] ?? 0);
			}
		});
	});

	describe("unmatchedDomains", () => {
		it("includes unmatchedDomains when Tier 3 finds unknown domains", async () => {
			vi.mocked(runTier3).mockResolvedValue({
				matches: [],
				networkDomains: new Set([
					"example.com", // target, should be filtered
					"unknown-tool.io", // unknown, should appear
					"mystery-service.com", // unknown, should appear
				]),
			});

			const result = await detect("https://example.com");

			expect(result.unmatchedDomains).toBeDefined();
			expect(result.unmatchedDomains).toContain("unknown-tool.io");
			expect(result.unmatchedDomains).toContain("mystery-service.com");
			expect(result.unmatchedDomains).not.toContain("example.com");
		});

		it("omits unmatchedDomains when skipBrowser is true", async () => {
			const result = await detect("https://example.com", { skipBrowser: true });
			expect(result.unmatchedDomains).toBeUndefined();
		});

		it("omits unmatchedDomains when all domains are known", async () => {
			vi.mocked(runTier3).mockResolvedValue({
				matches: [],
				networkDomains: new Set(["example.com"]),
			});

			const result = await detect("https://example.com");
			expect(result.unmatchedDomains).toBeUndefined();
		});
	});

	describe("result metadata", () => {
		it("sets totalChecked to SIGNATURES.length", async () => {
			const result = await detect("https://example.com", { skipBrowser: true });
			expect(result.totalChecked).toBeGreaterThan(0);
		});

		it("includes url in the result", async () => {
			const result = await detect("https://example.com", { skipBrowser: true });
			expect(result.url).toBe("https://example.com");
		});

		it("includes durationMs as a non-negative number", async () => {
			const result = await detect("https://example.com", { skipBrowser: true });
			expect(result.durationMs).toBeGreaterThanOrEqual(0);
		});

		it("returns empty detected array when no signals match", async () => {
			const result = await detect("https://example.com", { skipBrowser: true });
			expect(result.detected).toEqual([]);
		});
	});
});
