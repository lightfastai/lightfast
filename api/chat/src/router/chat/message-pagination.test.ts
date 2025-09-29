import { describe, expect, it } from "vitest";
import { selectRecordsByCharBudget } from "./message-pagination";

describe("selectRecordsByCharBudget", () => {
  const baseRecord = {
    role: "assistant" as const,
    parts: [],
    modelId: null,
    createdAt: new Date().toISOString(),
    tokenCount: null,
  };

  it("selects records until the character budget is reached", () => {
    const records = [
      { id: "m3", charCount: 50, ...baseRecord },
      { id: "m2", charCount: 30, ...baseRecord },
      { id: "m1", charCount: 40, ...baseRecord },
    ];

    const result = selectRecordsByCharBudget(records, 80);

    expect(result.selectedRecords.map((r) => r.id)).toEqual(["m3", "m2"]);
    expect(result.accumulatedChars).toBe(80);
    expect(result.hitCharBudget).toBe(false);
    expect(result.oversizeRecordId).toBeNull();
  });

  it("flags and returns a single oversized record when it exceeds the budget", () => {
    const records = [
      { id: "m3", charCount: 120, ...baseRecord },
      { id: "m2", charCount: 30, ...baseRecord },
      { id: "m1", charCount: 40, ...baseRecord },
    ];

    const result = selectRecordsByCharBudget(records, 80);

    expect(result.selectedRecords.map((r) => r.id)).toEqual(["m3"]);
    expect(result.accumulatedChars).toBe(120);
    expect(result.hitCharBudget).toBe(true);
    expect(result.oversizeRecordId).toBe("m3");
  });

  it("returns all records when no character limit is provided", () => {
    const records = [
      { id: "m3", charCount: 120, ...baseRecord },
      { id: "m2", charCount: 30, ...baseRecord },
      { id: "m1", charCount: 40, ...baseRecord },
    ];

    const result = selectRecordsByCharBudget(records, null);

    expect(result.selectedRecords.map((r) => r.id)).toEqual(["m3", "m2", "m1"]);
    expect(result.accumulatedChars).toBe(190);
    expect(result.hitCharBudget).toBe(false);
    expect(result.oversizeRecordId).toBeNull();
  });
});
