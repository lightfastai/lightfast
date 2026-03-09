import { describe, expect, it } from "vitest";
import { PROVIDER_DISPLAY, PROVIDER_SLUGS } from "../display";
import { PROVIDERS } from "../registry";

describe("display.ts ↔ registry.ts sync", () => {
  it("PROVIDER_DISPLAY keys match PROVIDERS keys", () => {
    const displayKeys = Object.keys(PROVIDER_DISPLAY).sort();
    const registryKeys = Object.keys(PROVIDERS).sort();
    expect(displayKeys).toEqual(registryKeys);
  });

  it("display strings match provider definitions", () => {
    for (const slug of PROVIDER_SLUGS) {
      const display = PROVIDER_DISPLAY[slug];
      const provider = PROVIDERS[slug];
      expect(display.name).toBe(provider.name);
      expect(display.displayName).toBe(provider.displayName);
      expect(display.description).toBe(provider.description);
    }
  });
});
