import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("aborts stalled remote careers content requests and falls back", async () => {
    vi.useFakeTimers();

    const { FALLBACK_CAREERS_CONTENT, getCareersContent } = await import(
      "~/app/(app)/(company)/careers/page"
    );

    let capturedSignal: AbortSignal | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;

        return new Promise((_resolve, reject) => {
          capturedSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      })
    );

    const contentPromise = getCareersContent();

    expect(capturedSignal).toBeInstanceOf(AbortSignal);

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(contentPromise).resolves.toBe(FALLBACK_CAREERS_CONTENT);
  });

  it("renders unsafe remote markdown links as non-clickable text", async () => {
    const { default: CareersPage } = await import(
      "~/app/(app)/(company)/careers/page"
    );

    const page = await CareersPage({
      content:
        "[Unsafe](javascript:alert) [ProtocolRelative](//example.com) [Safe](https://lightfast.ai)",
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("[Unsafe](javascript:alert)");
    expect(html).not.toContain('href="javascript:alert"');
    expect(html).toContain("[ProtocolRelative](//example.com)");
    expect(html).not.toContain('href="//example.com"');
    expect(html).toContain('href="https://lightfast.ai"');
  });
});
