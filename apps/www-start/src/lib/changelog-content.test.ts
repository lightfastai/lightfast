import { describe, expect, it } from "vitest";

describe("changelog content", () => {
  it("loads the migrated changelog entry with parsed frontmatter and body", async () => {
    const contentModule = await import("~/lib/changelog-content").catch(
      () => null
    );

    expect(contentModule).not.toBeNull();
    if (!contentModule) {
      return;
    }

    const pages = contentModule.getChangelogPages();
    const page = contentModule.getChangelogPage(
      "2026-03-26-lightfast-engineering-intelligence-shipped"
    );

    expect(pages.length).toBeGreaterThan(0);
    expect(
      pages.some(
        (candidate) =>
          candidate.slugs[0] ===
          "2026-03-26-lightfast-engineering-intelligence-shipped"
      )
    ).toBe(true);
    expect(page?.data.title).toBe("Engineering Intelligence, Shipped");
    expect(page?.data.version).toBe("v0.1.0");
    expect(page?.data.type).toBe("feature");
    expect(page?.body).toContain(
      "## How does the neural pipeline process events?"
    );
    expect(page?.url).toBe(
      "https://lightfast.ai/changelog/2026-03-26-lightfast-engineering-intelligence-shipped"
    );
  });
});
