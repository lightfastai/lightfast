import { describe, expect, it } from "vitest";

describe("blog content", () => {
  it("loads the migrated blog post with parsed frontmatter and body", async () => {
    const contentModule = await import("~/lib/blog-content").catch(() => null);

    expect(contentModule).not.toBeNull();
    if (!contentModule) {
      return;
    }

    const pages = contentModule.getBlogPages();
    const page = contentModule.getBlogPage(
      "2026-03-26-why-we-built-lightfast"
    );

    expect(pages).toHaveLength(1);
    expect(page?.data.title).toBe("Why We Built Lightfast");
    expect(page?.data.category).toBe("company");
    expect(page?.body).toContain("## The connecting tissue");
    expect(page?.url).toBe(
      "https://lightfast.ai/blog/2026-03-26-why-we-built-lightfast"
    );
  });
});
