import { describe, expect, it } from "vitest";

const { displayValue, formatStatusSubtitle } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-format"
);

describe("source-control-format", () => {
  it("prefixes the verb and formats a valid date", () => {
    expect(
      formatStatusSubtitle("Connected on", new Date("2026-06-01T00:00:00.000Z"))
    ).toMatch(/^Connected on /);
  });

  it("returns null for an invalid date", () => {
    expect(formatStatusSubtitle("Verified", new Date(Number.NaN))).toBeNull();
  });

  it("falls back to a placeholder for empty values", () => {
    expect(displayValue(null)).toBe("Not available");
    expect(displayValue("  ")).toBe("Not available");
    expect(displayValue("acme")).toBe("acme");
  });
});
