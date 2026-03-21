import { describe, expect, it } from "vitest";
import { PROVIDER_CATEGORIES } from "../client/categories";
import { PROVIDERS } from "../registry";

describe("PROVIDER_CATEGORIES sync", () => {
  for (const [slug, provider] of Object.entries(PROVIDERS)) {
    it(`${slug}: PROVIDER_CATEGORIES matches PROVIDERS[${slug}].categories`, () => {
      expect(
        PROVIDER_CATEGORIES[slug as keyof typeof PROVIDER_CATEGORIES]
      ).toEqual(provider.categories);
    });
  }
});
