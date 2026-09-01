import { afterEach, describe, expect, it, vi } from "vitest";

async function importWithAppUrl(appUrl?: string) {
  vi.resetModules();
  vi.doMock("../env/main", () => ({
    mainEnv: {
      APP_URL: appUrl,
    },
  }));
  return import("../main/app-origin");
}

afterEach(() => {
  vi.doUnmock("../env/main");
});

describe("resolveDesktopAppOrigin", () => {
  it("uses APP_URL for dev builds and normalizes to origin", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(
      "https://lightfast.localhost/dashboard?x=1"
    );

    expect(resolveDesktopAppOrigin("dev")).toBe("https://lightfast.localhost");
  });

  it("requires APP_URL for dev builds", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(undefined);

    expect(() => resolveDesktopAppOrigin("dev")).toThrow(/APP_URL must be set/);
  });

  it("uses APP_URL for packaged builds", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(
      "https://desktop-backend.example.test/dashboard"
    );

    expect(resolveDesktopAppOrigin("prod")).toBe(
      "https://desktop-backend.example.test"
    );
  });

  it("requires APP_URL for packaged builds", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(undefined);

    expect(() => resolveDesktopAppOrigin("prod")).toThrow(
      /APP_URL must be set/
    );
  });

  it("rejects unsupported build flavors", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(
      "https://lightfast.localhost"
    );

    expect(() =>
      resolveDesktopAppOrigin(
        "production" as Parameters<typeof resolveDesktopAppOrigin>[0]
      )
    ).toThrow();
  });
});
