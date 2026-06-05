import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("company page smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders the migrated company manifesto surface", async () => {
    const [
      { default: CompanyGroupLayout },
      { default: ManifestoPage, FALLBACK_LATEST_COMMIT },
    ] = await Promise.all([
      import("~/app/(app)/(company)/layout"),
      import("~/app/(app)/(company)/company/page"),
    ]);

    const page = await ManifestoPage({ latestCommit: FALLBACK_LATEST_COMMIT });
    const html = renderToStaticMarkup(
      createElement(CompanyGroupLayout, null, page)
    );

    expect(html).toContain("This is our specification.");
    expect(html).toContain("We are building the runtime.");
    expect(html).toContain("Read the Program");
    expect(html).toContain("Hold");
    expect(html).toContain('href="https://github.com/lightfastai/.lightfast');
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/company"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/careers"'
    );
  });
});
