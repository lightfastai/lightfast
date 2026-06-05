import { describe, expect, it } from "vitest";
import {
  buildLandingStructuredData,
  landingContent,
  marketingNav,
} from "./landing-content";

describe("landingContent", () => {
  it("keeps the migrated marketing shell anchored to the current Lightfast offer", () => {
    expect(landingContent.hero.title).toContain("superintelligence layer");
    expect(landingContent.hero.cta.href).toBe("/sign-up");
    expect(marketingNav.primary.map((item) => item.title)).toEqual([
      "Pricing",
      "Docs",
    ]);
    expect(marketingNav.resources.map((item) => item.title)).toEqual([
      "Blog",
      "Changelog",
    ]);
    expect(landingContent.featured.map((item) => item.href)).toContain(
      "/blog/2026-03-26-why-we-built-lightfast"
    );
    expect(landingContent.hero.badge.href).toBe(
      "/changelog/2026-03-26-lightfast-engineering-intelligence-shipped"
    );
  });

  it("builds organization, website, software, and faq structured data", () => {
    const graph = buildLandingStructuredData();

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((entity) => entity["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
    ]);
    expect(graph["@graph"][3]).toMatchObject({
      "@type": "FAQPage",
      mainEntity: expect.arrayContaining([
        expect.objectContaining({
          name: expect.stringContaining("founders"),
        }),
      ]),
    });
  });
});
