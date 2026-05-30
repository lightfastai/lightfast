import { describe, expect, it } from "vitest";
import type { SignalRow } from "./signals-model";
import { formatSignalConfidence, getSignalSource } from "./signals-model";

function rowWith(overrides: Record<string, unknown>): SignalRow {
  return overrides as SignalRow;
}

describe("formatSignalConfidence", () => {
  it("renders a 0..1 confidence as a rounded percentage", () => {
    expect(formatSignalConfidence(0.912)).toBe("91%");
    expect(formatSignalConfidence(0)).toBe("0%");
    expect(formatSignalConfidence(1)).toBe("100%");
  });
});

describe("getSignalSource", () => {
  it("labels API-key-created signals as an API key", () => {
    const source = getSignalSource(rowWith({ createdByApiKeyId: "key_123" }));
    expect(source).toEqual({ isApiKey: true, label: "API key" });
  });

  it("labels signals without an API key as a user", () => {
    const source = getSignalSource(rowWith({ createdByApiKeyId: null }));
    expect(source).toEqual({ isApiKey: false, label: "User" });
  });
});
