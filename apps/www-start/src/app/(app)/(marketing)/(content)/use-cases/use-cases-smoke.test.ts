import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUseCaseHead } from "~/lib/use-cases-content";

const env = {
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VITE_LIGHTFAST_PLATFORM_URL: "https://platform.lightfast.localhost",
  VITE_LIGHTFAST_WWW_URL: "https://www.lightfast.localhost",
  VITE_WWW_START_URL: "https://www-start.lightfast.localhost",
};

describe("use-case pages smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
  });

  it("renders a migrated use-case page inside the marketing shell", async () => {
    const [{ default: MarketingLayout }, { default: AgentBuildersPage }] =
      await Promise.all([
        import("~/app/(app)/(marketing)/layout"),
        import("~/app/(app)/(marketing)/(content)/use-cases/agent-builders/page"),
      ]);

    const html = renderToStaticMarkup(
      createElement(
        MarketingLayout,
        null,
        createElement(AgentBuildersPage)
      )
    );

    expect(html).toContain("Agent Builders");
    expect(html).toContain("Real-time stack health pulse");
    expect(html).toContain("Deployment risk scoring");
    expect(html).toContain('href="https://app.lightfast.localhost/sign-up"');
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/docs/get-started/overview"'
    );
  });

  it("keeps docs overview use-case links on www-start after migration", async () => {
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
        { currentPath: "/docs/get-started/overview" },
        createElement(DeveloperPlatformLanding)
      )
    );

    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/use-cases/agent-builders"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/use-cases/engineering-leaders"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/use-cases/platform-engineers"'
    );
    expect(html).toContain(
      'href="https://www-start.lightfast.localhost/use-cases/technical-founders"'
    );
  });

  it("provides route head metadata for all use-case pages", () => {
    expect(buildUseCaseHead("agent-builders").meta).toContainEqual({
      title: "Lightfast for Agent Builders - Build the Superintelligence Layer",
    });
    expect(buildUseCaseHead("engineering-leaders").links).toContainEqual({
      rel: "canonical",
      href: "https://lightfast.ai/use-cases/engineering-leaders",
    });
    expect(buildUseCaseHead("platform-engineers").meta).toContainEqual({
      property: "og:title",
      content: "Lightfast for Platform Engineers",
    });
    expect(buildUseCaseHead("technical-founders").links).toContainEqual({
      rel: "canonical",
      href: "https://lightfast.ai/use-cases/technical-founders",
    });
  });
});
