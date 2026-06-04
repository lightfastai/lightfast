import { describe, expect, it } from "vitest";
import { buildRootHead } from "./root-head";

describe("buildRootHead", () => {
  it("provides the baseline SEO and app shell links", () => {
    const head = buildRootHead();

    expect(head.meta).toContainEqual({
      title: "Lightfast - The Operating Layer for Agents and Apps",
    });
    expect(head.meta).toContainEqual({
      name: "description",
      content:
        "Lightfast is the operating layer between your agents and apps.",
    });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://lightfast.ai",
    });
    expect(head.links).toContainEqual({
      rel: "manifest",
      href: "/manifest.json",
    });
  });
});
