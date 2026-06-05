import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPricingFaqStructuredData,
  buildPricingHead,
  buildPricingSoftwareStructuredData,
} from "~/lib/pricing-content";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("pricing page smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders the migrated pricing page with plan cards, faq, and json-ld", async () => {
    const [{ default: MarketingLayout }, { default: PricingPage }] =
      await Promise.all([
        import("~/app/(app)/(marketing)/layout"),
        import("~/app/(app)/(marketing)/(content)/pricing/page"),
      ]);

    const html = renderToStaticMarkup(
      createElement(MarketingLayout, null, createElement(PricingPage))
    );

    expect(html).toContain("Choose the plan that fits your team");
    expect(html).toContain("Starter");
    expect(html).toContain("Team");
    expect(html).toContain("Business");
    expect(html).toContain("What makes Lightfast worth $20/user?");
    expect(html).toContain('href="mailto:sales@lightfast.ai"');
    expect(html).toContain("pt-28");
    expect(html).toContain("md:pt-32");
    expect(html.split('type="application/ld+json"')).toHaveLength(3);
  });

  it("provides route head metadata and pricing structured data", () => {
    const head = buildPricingHead();
    const software = buildPricingSoftwareStructuredData();
    const faq = buildPricingFaqStructuredData();

    expect(head.meta).toContainEqual({
      title: "Lightfast Pricing - Scales With Your Team",
    });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://lightfast.ai/pricing",
    });
    expect(software.offers.map((offer) => offer.name)).toEqual([
      "Starter",
      "Team",
      "Business",
    ]);
    expect(faq.mainEntity).toHaveLength(9);
  });
});
