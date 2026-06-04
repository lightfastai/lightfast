import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocsPage } from "~/lib/docs-content";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("docs overview smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders the migrated docs overview inside the docs shell", async () => {
    const page = getDocsPage(["get-started", "overview"]);
    expect(page).toBeDefined();

    const [{ default: DocsShell }, { default: DeveloperPlatformLanding }] =
      await Promise.all([
        import("~/app/(app)/(content)/docs/docs-shell"),
        import(
          "~/app/(app)/(content)/docs/(general)/[[...slug]]/_components/developer-platform-landing"
        ),
      ]);

    const html = renderToStaticMarkup(
      createElement(
        DocsShell,
        { currentPath: page!.path },
        createElement(DeveloperPlatformLanding)
      )
    );

    expect(html).toContain("Lightfast");
    expect(html).toContain("Memory built for teams");
    expect(html).toContain("Getting Started");
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("border-r");
    expect(html).not.toMatch(/\bborder-b\b/);
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/docs/get-started/overview"'
    );
    expect(html).toContain(
      'href="https://www.lightfast.localhost/docs/get-started/quickstart"'
    );
  });
});
