import { describe, expect, it } from "vitest";

import { computeConfidence, confidenceLevel } from "./scoring.js";
import type { RuleMatch } from "./types.js";

function makeMatch(confidence: number): RuleMatch {
	return {
		toolId: "test-tool",
		vector: "header",
		tier: 1,
		confidence,
		evidence: "test evidence",
	};
}

describe("computeConfidence", () => {
	it("returns 0 for empty signals", () => {
		expect(computeConfidence([])).toBe(0);
	});

	it("returns the confidence for a single signal", () => {
		// 1 - (1 - x) can differ from x by floating point epsilon; use toBeCloseTo
		expect(computeConfidence([makeMatch(0.95)])).toBeCloseTo(0.95, 10);
		expect(computeConfidence([makeMatch(0.5)])).toBeCloseTo(0.5, 10);
		expect(computeConfidence([makeMatch(0.3)])).toBeCloseTo(0.3, 10);
	});

	it("applies Noisy-OR formula for two signals", () => {
		// P = 1 - (1 - 0.8) * (1 - 0.6) = 1 - 0.2 * 0.4 = 1 - 0.08 = 0.92
		const result = computeConfidence([makeMatch(0.8), makeMatch(0.6)]);
		expect(result).toBeCloseTo(0.92, 10);
	});

	it("compounds three signals higher than any single signal", () => {
		const single = computeConfidence([makeMatch(0.7)]);
		const triple = computeConfidence([makeMatch(0.7), makeMatch(0.7), makeMatch(0.7)]);
		expect(triple).toBeGreaterThan(single);
	});

	it("approaches 1 with many high-confidence signals", () => {
		const signals = Array.from({ length: 5 }, () => makeMatch(0.9));
		expect(computeConfidence(signals)).toBeGreaterThan(0.999);
	});

	it("never exceeds 1", () => {
		const signals = Array.from({ length: 20 }, () => makeMatch(0.99));
		expect(computeConfidence(signals)).toBeLessThanOrEqual(1);
	});

	it("is commutative — order of signals does not change the result", () => {
		const a = computeConfidence([makeMatch(0.8), makeMatch(0.3)]);
		const b = computeConfidence([makeMatch(0.3), makeMatch(0.8)]);
		expect(a).toBeCloseTo(b, 10);
	});

	it("handles confidence of 1.0 in a signal — result is exactly 1", () => {
		// 1 - (1 - 1.0) * anything = 1 - 0 = 1
		const result = computeConfidence([makeMatch(1.0), makeMatch(0.5)]);
		expect(result).toBe(1);
	});

	it("handles confidence of 0 signals — they do not change the result", () => {
		const withZero = computeConfidence([makeMatch(0.7), makeMatch(0)]);
		const withoutZero = computeConfidence([makeMatch(0.7)]);
		expect(withZero).toBeCloseTo(withoutZero, 10);
	});
});

describe("confidenceLevel", () => {
	it("returns 'detected' for score >= 0.8", () => {
		expect(confidenceLevel(0.8)).toBe("detected");
		expect(confidenceLevel(0.9)).toBe("detected");
		expect(confidenceLevel(1.0)).toBe("detected");
	});

	it("returns 'likely' for score >= 0.5 and < 0.8", () => {
		expect(confidenceLevel(0.5)).toBe("likely");
		expect(confidenceLevel(0.65)).toBe("likely");
		expect(confidenceLevel(0.799)).toBe("likely");
	});

	it("returns 'possible' for score < 0.5", () => {
		expect(confidenceLevel(0.499)).toBe("possible");
		expect(confidenceLevel(0.3)).toBe("possible");
		expect(confidenceLevel(0)).toBe("possible");
	});

	it("boundary 0.8 maps to detected, not likely", () => {
		expect(confidenceLevel(0.8)).toBe("detected");
	});

	it("boundary 0.5 maps to likely, not possible", () => {
		expect(confidenceLevel(0.5)).toBe("likely");
	});
});
