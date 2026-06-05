import { describe, expect, it } from "vitest";
import { getSitemapEntries } from "~/lib/seo-discovery";

describe("sitemap", () => {
  it("does not advertise the retired access URL", () => {
    const urls = getSitemapEntries().map((entry) => entry.url);
    const retiredPath = ["early", "access"].join("-");
    const retiredUrl = ["https://lightfast.ai", retiredPath].join("/");

    expect(urls).not.toContain(retiredUrl);
  });
});
