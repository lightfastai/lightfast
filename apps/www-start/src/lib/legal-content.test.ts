import { describe, expect, it } from "vitest";
import {
  buildLegalHead,
  buildLegalJsonLd,
  getLegalPage,
  getLegalPages,
} from "~/lib/legal-content";

describe("legal content", () => {
  it("loads the migrated legal documents from the copied MDX sources", () => {
    const pages = getLegalPages();

    expect(pages.map((page) => page.slug).sort()).toEqual(["privacy", "terms"]);
    expect(getLegalPage("privacy")?.data.title).toBe("Privacy Policy");
    expect(getLegalPage("terms")?.data.title).toBe("Terms of Service");
    expect(getLegalPage("privacy")?.body).toContain("# Privacy Policy");
  });

  it("builds legal page head metadata from frontmatter", () => {
    const page = getLegalPage("privacy");

    expect(page).toBeDefined();
    const head = buildLegalHead(page!);

    expect(head.meta).toContainEqual({ title: "Privacy Policy – Lightfast" });
    expect(head.meta).toContainEqual({
      name: "description",
      content:
        "Lightfast Privacy Policy — how we collect, use, and protect your data when you use the Lightfast platform and services.",
    });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://lightfast.ai/legal/privacy",
    });
  });

  it("builds legal JSON-LD with webpage and breadcrumb entities", () => {
    const page = getLegalPage("terms");

    expect(page).toBeDefined();
    const jsonLd = buildLegalJsonLd(page!);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "WebPage",
          name: "Terms of Service",
          url: "https://lightfast.ai/legal/terms",
        }),
        expect.objectContaining({
          "@type": "BreadcrumbList",
        }),
      ])
    );
  });
});
