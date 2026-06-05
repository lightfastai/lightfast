import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("careers page smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders the migrated careers terminal surface", async () => {
    const [
      { default: CompanyGroupLayout },
      { default: CareersPage, FALLBACK_CAREERS_CONTENT },
    ] = await Promise.all([
      import("~/app/(app)/(company)/layout"),
      import("~/app/(app)/(company)/careers/page"),
    ]);

    const page = await CareersPage({ content: FALLBACK_CAREERS_CONTENT });
    const html = renderToStaticMarkup(
      createElement(CompanyGroupLayout, null, page)
    );

    expect(html).toContain("LIGHTFAST");
    expect(html).toContain("CONTACT: JOBS@LIGHTFAST.AI");
    expect(html).toContain("OPEN POSITIONS: None for now.");
    expect(html).toContain("https://github.com/lightfastai/lightfast");
    expect(html).toContain("https://github.com/lightfastai/.lightfast");
  });
});
