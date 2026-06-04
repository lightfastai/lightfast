import { describe, expect, it } from "vitest";

describe("content feeds", () => {
  it("generates blog RSS and Atom feeds from migrated content", async () => {
    const feedModule = await import("~/lib/content-feeds").catch(() => null);

    expect(feedModule).not.toBeNull();
    if (!feedModule) {
      return;
    }

    const rss = feedModule.generateBlogFeed().rss2();
    const atom = feedModule.generateBlogFeed().atom1();

    expect(rss).toContain("<title>Lightfast Blog</title>");
    expect(rss).toContain(
      "https://lightfast.ai/blog/2026-03-26-why-we-built-lightfast"
    );
    expect(atom).toContain("<title>Lightfast Blog</title>");
  });

  it("generates changelog RSS and Atom feeds from migrated content", async () => {
    const feedModule = await import("~/lib/content-feeds").catch(() => null);

    expect(feedModule).not.toBeNull();
    if (!feedModule) {
      return;
    }

    const rss = feedModule.generateChangelogFeed().rss2();
    const atom = feedModule.generateChangelogFeed().atom1();

    expect(rss).toContain("<title>Lightfast Changelog</title>");
    expect(rss).toContain(
      "https://lightfast.ai/changelog/2026-03-26-lightfast-engineering-intelligence-shipped"
    );
    expect(atom).toContain("<title>Lightfast Changelog</title>");
  });
});
