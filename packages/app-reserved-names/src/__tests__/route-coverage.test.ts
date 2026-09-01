import { describe, expect, it } from "vitest";

import { organization } from "../index";

const stablePublicNames = [
  "api",
  "blog",
  "brand",
  "company",
  "docs",
  "home",
  "legal",
  "llms.txt",
  "pitch-deck",
  "pricing",
  "privacy",
  "sign-in",
  "terms",
] as const;

describe("stable public name coverage", () => {
  it("retains public route names without reading another app or repository", () => {
    expect(
      stablePublicNames.filter((name) => !organization.check(name))
    ).toEqual([]);
  });
});
