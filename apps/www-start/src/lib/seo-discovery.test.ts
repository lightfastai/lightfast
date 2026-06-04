import { describe, expect, it } from "vitest";

describe("SEO discovery content", () => {
  it("builds sitemap entries for migrated public pages", async () => {
    const seoModule = await import("~/lib/seo-discovery").catch(() => null);

    expect(seoModule).not.toBeNull();
    if (!seoModule) {
      return;
    }

    const entries = seoModule.getSitemapEntries();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        "https://lightfast.ai",
        "https://lightfast.ai/blog",
        "https://lightfast.ai/blog/2026-03-26-why-we-built-lightfast",
        "https://lightfast.ai/blog/topic/company",
        "https://lightfast.ai/changelog",
        "https://lightfast.ai/changelog/2026-03-26-lightfast-engineering-intelligence-shipped",
        "https://lightfast.ai/legal/privacy",
        "https://lightfast.ai/legal/terms",
      ])
    );
    expect(urls).not.toContain("https://lightfast.ai/early-access");
  });

  it("serializes sitemap XML with expected public URLs", async () => {
    const seoModule = await import("~/lib/seo-discovery").catch(() => null);

    expect(seoModule).not.toBeNull();
    if (!seoModule) {
      return;
    }

    const xml = seoModule.generateSitemapXml();

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://lightfast.ai/blog</loc>");
    expect(xml).toContain(
      "<loc>https://lightfast.ai/changelog/2026-03-26-lightfast-engineering-intelligence-shipped</loc>"
    );
  });

  it("generates production and non-production robots.txt", async () => {
    const seoModule = await import("~/lib/seo-discovery").catch(() => null);

    expect(seoModule).not.toBeNull();
    if (!seoModule) {
      return;
    }

    expect(seoModule.generateRobotsTxt("development")).toContain("Disallow: /");

    const productionRobots = seoModule.generateRobotsTxt("production");
    expect(productionRobots).toContain("Allow: /llms.txt");
    expect(productionRobots).toContain("Disallow: /api/");
    expect(productionRobots).not.toContain("/pitch-deck");
    expect(productionRobots).toContain("Sitemap: https://lightfast.ai/sitemap.xml");
  });

  it("generates llms.txt for the public marketing and content pages", async () => {
    const seoModule = await import("~/lib/seo-discovery").catch(() => null);

    expect(seoModule).not.toBeNull();
    if (!seoModule) {
      return;
    }

    const llmsTxt = await seoModule.generateLlmsTxt();

    expect(llmsTxt).toContain("# Lightfast");
    expect(llmsTxt).toContain(
      "- [Lightfast for Technical Founders](https://lightfast.ai/use-cases/technical-founders)"
    );
    expect(llmsTxt).toContain(
      "- [API Reference](https://lightfast.ai/docs/api-reference)"
    );
    expect(llmsTxt).toContain(
      "- [Why We Built Lightfast](https://lightfast.ai/blog/2026-03-26-why-we-built-lightfast)"
    );
    expect(llmsTxt).toContain(
      "- [Engineering Intelligence, Shipped](https://lightfast.ai/changelog/2026-03-26-lightfast-engineering-intelligence-shipped)"
    );
    expect(llmsTxt).toContain("- [Privacy Policy](https://lightfast.ai/legal/privacy)");
    expect(llmsTxt).toContain("## Contact & Support");
  });
});
