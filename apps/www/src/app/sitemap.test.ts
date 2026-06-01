import { describe, expect, it, vi } from "vitest";

vi.mock("~/app/(app)/(content)/_lib/source", () => ({
  getBlogPages: () => [],
  getChangelogPages: () => [],
  getLegalPages: () => [],
}));

const { default: sitemap } = await import("./sitemap");

describe("sitemap", () => {
  it("does not advertise the retired access URL", () => {
    const urls = sitemap().map((entry) => entry.url);
    const retiredPath = ["early", "access"].join("-");
    const retiredUrl = ["https://lightfast.ai", retiredPath].join("/");

    expect(urls).not.toContain(retiredUrl);
  });
});
