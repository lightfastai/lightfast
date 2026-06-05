import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("landing page smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders the migrated marketing shell with desktop and mobile navigation", async () => {
    const [{ default: MarketingLayout }, { default: HomePage }] =
      await Promise.all([
        import("~/app/(app)/(marketing)/layout"),
        import("~/app/(app)/(marketing)/(landing)/page"),
      ]);

    const html = renderToStaticMarkup(
      createElement(MarketingLayout, null, createElement(HomePage))
    );

    expect(html).toContain("Building the");
    expect(html).toContain("superintelligence layer");
    expect(html).toContain("teams and agents.");
    expect(html).toContain('aria-label="Toggle Menu"');
    expect(html).toContain('data-slot="navigation-menu-trigger"');
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/pricing"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/docs/get-started/overview"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/legal/privacy"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/legal/terms"'
    );
    expect(html).toContain('href="https://app.lightfast.localhost/sign-up"');
    expect(html).toContain('type="application/ld+json"');
  });
});
