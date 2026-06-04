import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLegalPage } from "~/lib/legal-content";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("legal page smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders legal content inside the migrated marketing shell", async () => {
    const page = getLegalPage("privacy");
    expect(page).toBeDefined();

    const [
      { default: MarketingLayout },
      { default: LegalLayout },
      { default: LegalPageView },
    ] = await Promise.all([
      import("~/app/(app)/(marketing)/layout"),
      import("~/app/(app)/(marketing)/legal/layout"),
      import("~/app/(app)/(marketing)/legal/page"),
    ]);

    const html = renderToStaticMarkup(
      createElement(
        MarketingLayout,
        null,
        createElement(
          LegalLayout,
          null,
          createElement(LegalPageView, { page: page! })
        )
      )
    );

    expect(html).toContain("Privacy Policy");
    expect(html).toContain("<table");
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/legal/privacy"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/legal/terms"'
    );
  });
});
