import { describe, expect, it, vi } from "vitest";
import { verifyGitHubEmulatorInstallation } from "../emulator-verifier";

function pathnameFor(url: Parameters<typeof fetch>[0]): string {
  return new URL(url instanceof Request ? url.url : url).pathname;
}

describe("verifyGitHubEmulatorInstallation", () => {
  it("verifies a matching org installation through emulator-supported endpoints", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const pathname = pathnameFor(url);
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([{ id: 20, login: "lightfast-emulated" }]);
      }
      if (pathname === "/orgs/lightfast-emulated/installation") {
        return Response.json({
          id: 1001,
          account: {
            id: 20,
            login: "lightfast-emulated",
            type: "Organization",
          },
          app_id: 424242,
          app_slug: "lightfast-local",
          events: ["issues"],
          permissions: { contents: "read" },
          repository_selection: "all",
          suspended_at: null,
          target_type: "Organization",
        });
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).resolves.toMatchObject({
      account: { login: "lightfast-emulated", type: "Organization" },
      id: "1001",
      targetType: "Organization",
    });
  });

  it("rejects an inaccessible org installation", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const pathname = pathnameFor(url);
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([]);
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("wraps malformed installation payloads in a typed verification error", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const pathname = pathnameFor(url);
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([{ id: 20, login: "lightfast-emulated" }]);
      }
      if (pathname === "/orgs/lightfast-emulated/installation") {
        return Response.json({
          id: 1001,
          account: {
            id: 20,
            login: "",
            type: "Organization",
          },
          app_id: 424242,
          target_type: "Organization",
        });
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("rejects a mismatched installation id with a typed verification error", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const pathname = pathnameFor(url);
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([{ id: 20, login: "lightfast-emulated" }]);
      }
      if (pathname === "/orgs/lightfast-emulated/installation") {
        return Response.json({
          id: 9999,
          account: {
            id: 20,
            login: "lightfast-emulated",
            type: "Organization",
          },
          app_id: 424242,
          app_slug: "lightfast-local",
          events: ["issues"],
          permissions: { contents: "read" },
          repository_selection: "all",
          target_type: "Organization",
        });
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("rejects personal account installations with a typed unsupported-account error", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const pathname = pathnameFor(url);
      if (pathname === "/user") {
        return Response.json({ id: 10, login: "lightfast-dev" });
      }
      if (pathname === "/user/orgs") {
        return Response.json([{ id: 20, login: "lightfast-emulated" }]);
      }
      if (pathname === "/orgs/lightfast-emulated/installation") {
        return Response.json({
          id: 1001,
          account: {
            id: 10,
            login: "lightfast-dev",
            type: "User",
          },
          app_id: 424242,
          app_slug: "lightfast-local",
          events: ["issues"],
          permissions: { contents: "read" },
          repository_selection: "all",
          target_type: "User",
        });
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "PERSONAL_ACCOUNT_NOT_SUPPORTED" });
  });

  it("wraps invalid JSON responses in a typed verification error", async () => {
    const fetchMock = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const pathname = pathnameFor(url);
      if (pathname === "/user") {
        return new Response("{", {
          headers: { "content-type": "application/json" },
        });
      }
      return Response.json({ message: "Not Found" }, { status: 404 });
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });

  it("wraps fetch rejections in a typed verification error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      verifyGitHubEmulatorInstallation({
        emulatorOrigin: "http://127.0.0.1:4567",
        expectedInstallationId: "1001",
        expectedOrgLogin: "lightfast-emulated",
        fetch: fetchMock,
        userAccessToken: "gho_test",
      })
    ).rejects.toMatchObject({ code: "INSTALLATION_NOT_VERIFIED" });
  });
});
