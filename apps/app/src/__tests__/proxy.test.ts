import { beforeEach, describe, expect, it, vi } from "vitest";

interface LastActiveOrg {
  id: string;
  slug: string;
}

interface AuthResult {
  orgId?: string | null;
  orgSlug?: string | null;
  sessionClaims?: {
    last_active_org?: LastActiveOrg | null;
    lf_binding_status?: unknown;
  } | null;
  sessionStatus?: "active" | "pending";
  userId?: string | null;
}

const authMock = vi.fn<() => Promise<AuthResult>>();
const createNEMOMock = vi.fn(
  (
    middlewares: Record<string, (req: RequestLike, event: EventLike) => unknown>,
    globalMiddleware?: {
      before?:
        | ((req: RequestLike, event: EventLike) => unknown)
        | Array<(req: RequestLike, event: EventLike) => unknown>;
    }
  ) =>
    async (req: RequestLike, event: EventLike) => {
      const beforeMiddlewares = Array.isArray(globalMiddleware?.before)
        ? globalMiddleware.before
        : globalMiddleware?.before
          ? [globalMiddleware.before]
          : [];

      for (const middleware of beforeMiddlewares) {
        const response = await middleware(req, event);
        if (response) {
          return response;
        }
      }

      return middlewares["/:path*"]?.(req, event);
    }
);
const runMicrofrontendsMiddlewareMock = vi.fn();
const updateUserMetadataMock = vi.fn();

vi.mock("@rescale/nemo", () => ({
  createNEMO: createNEMOMock,
}));

vi.mock("@vercel/microfrontends/next/middleware", () => ({
  runMicrofrontendsMiddleware: runMicrofrontendsMiddlewareMock,
}));

vi.mock("@vendor/security/csp", () => ({
  composeCspOptions: () => ({}),
  createAnalyticsCspDirectives: () => ({}),
  createClerkCspDirectives: () => ({}),
  createNextjsCspDirectives: () => ({}),
  createSentryCspDirectives: () => ({}),
  createStripeCspDirectives: () => ({}),
}));

vi.mock("@vendor/security/middleware", () => ({
  securityMiddleware: () => () =>
    Promise.resolve(
      new Response(null, {
        headers: {
          "x-test-security": "applied",
        },
      })
    ),
}));

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: vi.fn(() =>
    Promise.resolve({
      users: {
        updateUserMetadata: updateUserMetadataMock,
      },
    })
  ),
  clerkMiddleware:
    (
      handler: (
        auth: typeof authMock,
        req: RequestLike,
        event: EventLike
      ) => Promise<Response>
    ) =>
    (req: RequestLike, event: EventLike) =>
      handler(authMock, req, event),
  createRouteMatcher: (patterns: string[]) => (req: RequestLike) => {
    const pathname = req.nextUrl.pathname;
    return patterns.some((pattern) => matchesPattern(pattern, pathname));
  },
}));

interface RequestLike {
  nextUrl: URL;
  url: string;
}

interface EventLike {
  waitUntil: ReturnType<typeof vi.fn>;
}

function matchesPattern(pattern: string, pathname: string) {
  if (pattern === "/:slug") {
    return /^\/[^/]+\/?$/.test(pathname);
  }
  if (pattern === "/:slug/(.*)") {
    return /^\/[^/]+(?:\/.*)?$/.test(pathname);
  }
  if (pattern === "/:slug/settings(.*)") {
    return /^\/[^/]+\/settings(?:\/.*)?$/.test(pathname);
  }
  if (pattern === "/:slug/tasks/bind(.*)") {
    return /^\/[^/]+\/tasks\/bind(?:\/.*)?$/.test(pathname);
  }
  if (pattern.endsWith("(.*)")) {
    const prefix = pattern.slice(0, -4);
    return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
  }
  return pathname === pattern;
}

const { default: proxy } = await import("~/proxy");

function makeReq(pathname: string): RequestLike {
  const url = new URL(pathname, "https://app.lightfast.localhost");
  return { nextUrl: url, url: url.toString() };
}

async function invoke(pathname: string, event = { waitUntil: vi.fn() }) {
  const response = (await proxy(
    makeReq(pathname) as never,
    event as never
  )) as Response;
  return { event, response };
}

beforeEach(() => {
  authMock.mockReset();
  runMicrofrontendsMiddlewareMock.mockReset();
  runMicrofrontendsMiddlewareMock.mockResolvedValue(null);
  updateUserMetadataMock.mockReset();
  updateUserMetadataMock.mockResolvedValue({});
  authMock.mockResolvedValue({
    orgId: "org_123",
    orgSlug: "acme",
    sessionClaims: { lf_binding_status: "bound" },
    sessionStatus: "active",
    userId: "user_123",
  });
});

describe("proxy Nemo composition", () => {
  it("runs microfrontends before the Clerk proxy through Nemo", () => {
    expect(createNEMOMock).toHaveBeenCalledTimes(1);
    expect(createNEMOMock).toHaveBeenCalledWith(
      { "/:path*": expect.any(Function) },
      { before: [expect.any(Function)] }
    );
  });
});

describe("proxy post-auth routing", () => {
  it("redirects signed-in users from the root to the active org slug", async () => {
    const { response } = await invoke("/");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme"
    );
  });

  it("redirects signed-in users from auth routes to the last active org claim when no org is active", async () => {
    authMock.mockResolvedValue({
      orgId: null,
      orgSlug: null,
      sessionClaims: {
        last_active_org: { id: "org_last", slug: "last-team" },
        lf_binding_status: "bound",
      },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/sign-in");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/last-team"
    );
  });

  it("redirects signed-in users without active or last active org to team creation", async () => {
    authMock.mockResolvedValue({
      orgId: null,
      orgSlug: null,
      sessionClaims: { lf_binding_status: "bound" },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/account/teams/new"
    );
  });

  it("redirects pending sessions to team creation even when a stale last active org claim exists", async () => {
    authMock.mockResolvedValue({
      orgId: null,
      orgSlug: null,
      sessionClaims: {
        last_active_org: { id: "org_old", slug: "old-team" },
        lf_binding_status: "bound",
      },
      sessionStatus: "pending",
      userId: "user_123",
    });

    const { response } = await invoke("/");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/account/teams/new"
    );
  });
});

describe("proxy pending-session route handling", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({
      orgId: null,
      orgSlug: null,
      sessionClaims: null,
      sessionStatus: "pending",
      userId: "user_123",
    });
  });

  it.each(["/account/settings", "/cli/auth", "/desktop/auth"])(
    "allows pending sessions through %s",
    async (pathname) => {
      const { response } = await invoke(pathname);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  );

  it("leaves tRPC auth to the API handler instead of pending-page routing", async () => {
    const { response } = await invoke(
      "/api/trpc/viewer.organization.create?batch=1"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe("proxy bound org product route gate", () => {
  it("redirects unbound orgs from the workspace root to the bind task", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: { lf_binding_status: "unbound" },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/acme");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.lightfast.localhost/acme/tasks/bind"
    );
  });

  it("passes bound orgs through on the workspace root", async () => {
    const { response } = await invoke("/acme");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/acme/workspace", "/acme/runs/123"])(
    "redirects unbound org product routes from %s to the bind task",
    async (pathname) => {
      authMock.mockResolvedValue({
        orgId: "org_123",
        orgSlug: "acme",
        sessionClaims: { lf_binding_status: "unbound" },
        sessionStatus: "active",
        userId: "user_123",
      });

      const { response } = await invoke(pathname);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://app.lightfast.localhost/acme/tasks/bind"
      );
    }
  );

  it("does not gate org settings routes", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: { lf_binding_status: "unbound" },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/acme/settings");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not gate nested org settings routes", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: { lf_binding_status: "unbound" },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/acme/settings/api-keys");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not gate task setup routes", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: { lf_binding_status: "unbound" },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/acme/tasks/bind");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not treat reserved routes as org product routes", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: { lf_binding_status: "unbound" },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { response } = await invoke("/account/settings");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy last active org persistence", () => {
  it("schedules a background metadata merge when the org route differs from the session claim", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: {
        last_active_org: { id: "org_old", slug: "old-team" },
        lf_binding_status: "bound",
      },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { event, response } = await invoke("/acme");

    expect(response.status).toBe(200);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await event.waitUntil.mock.calls[0]?.[0];
    expect(updateUserMetadataMock).toHaveBeenCalledWith("user_123", {
      publicMetadata: {
        last_active_org: { id: "org_123", slug: "acme" },
      },
    });
  });

  it("does not schedule a metadata merge when the session claim already matches", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: {
        last_active_org: { id: "org_123", slug: "acme" },
        lf_binding_status: "bound",
      },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { event, response } = await invoke("/acme");

    expect(response.status).toBe(200);
    expect(event.waitUntil).not.toHaveBeenCalled();
  });

  it("does not schedule a metadata merge when the route slug does not match Clerk's active org slug", async () => {
    authMock.mockResolvedValue({
      orgId: "org_123",
      orgSlug: "acme",
      sessionClaims: {
        last_active_org: { id: "org_old", slug: "old-team" },
        lf_binding_status: "bound",
      },
      sessionStatus: "active",
      userId: "user_123",
    });

    const { event, response } = await invoke("/different-team");

    expect(response.status).toBe(200);
    expect(event.waitUntil).not.toHaveBeenCalled();
    expect(updateUserMetadataMock).not.toHaveBeenCalled();
  });

  it("does not change the response when the background metadata merge fails", async () => {
    updateUserMetadataMock.mockRejectedValue(new Error("clerk unavailable"));

    const { event, response } = await invoke("/acme");

    expect(response.status).toBe(200);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await expect(event.waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
  });
});

describe("proxy security headers", () => {
  it("applies security headers to normal responses", async () => {
    const { response } = await invoke("/acme/settings");

    expect(response.headers.get("x-test-security")).toBe("applied");
  });

  it("applies security headers to microfrontend responses without replacing existing response details", async () => {
    runMicrofrontendsMiddlewareMock.mockResolvedValue(
      new Response("mfe-body", {
        headers: {
          "x-mfe": "preserved",
        },
        status: 202,
      })
    );

    const { response } = await invoke(
      "/.well-known/vercel/microfrontends/client-config"
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("x-mfe")).toBe("preserved");
    expect(response.headers.get("x-test-security")).toBe("applied");
    expect(authMock).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe("mfe-body");
  });
});
