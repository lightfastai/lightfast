import { describe, expect, it } from "vitest";
import {
  buildDocsHead,
  buildDocsJsonLd,
  docsNavigation,
  getDocsPage,
  getDocsPages,
} from "~/lib/docs-content";

describe("docs content", () => {
  it("loads the migrated overview page from the copied MDX source", () => {
    const page = getDocsPage(["get-started", "overview"]);

    expect(page).toBeDefined();
    expect(page?.slug).toEqual(["get-started", "overview"]);
    expect(page?.data.title).toBe("Overview");
    expect(page?.data.description).toContain("memory layer");
    expect(getDocsPages().map((item) => item.path)).toEqual([
      "/docs/get-started/overview",
    ]);
  });

  it("keeps the docs navigation aware of migrated and delegated pages", () => {
    expect(docsNavigation.map((section) => section.title)).toEqual([
      "Getting Started",
      "Integrate",
    ]);
    expect(docsNavigation[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Overview",
          href: "/docs/get-started/overview",
          migrated: true,
        }),
        expect.objectContaining({
          title: "Quickstart",
          href: "/docs/get-started/quickstart",
          migrated: false,
        }),
      ])
    );
  });

  it("builds docs head metadata from frontmatter", () => {
    const page = getDocsPage(["get-started", "overview"]);

    expect(page).toBeDefined();
    const head = buildDocsHead(page!);

    expect(head.meta).toContainEqual({ title: "Overview – Lightfast Docs" });
    expect(head.meta).toContainEqual({
      name: "description",
      content:
        "The memory layer for software teams - search everything your engineering org knows across tools, code, and conversations.",
    });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://lightfast.ai/docs/get-started/overview",
    });
  });

  it("builds docs JSON-LD with webpage and breadcrumb entities", () => {
    const page = getDocsPage(["get-started", "overview"]);

    expect(page).toBeDefined();
    const jsonLd = buildDocsJsonLd(page!);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "WebPage",
          name: "Overview",
          url: "https://lightfast.ai/docs/get-started/overview",
        }),
        expect.objectContaining({
          "@type": "BreadcrumbList",
          itemListElement: expect.arrayContaining([
            expect.objectContaining({ name: "Docs" }),
            expect.objectContaining({ name: "Overview" }),
          ]),
        }),
      ])
    );
  });
});
