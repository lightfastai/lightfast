import { beforeEach, describe, expect, it, vi } from "vitest";

type LastActiveOrg = { id: string; slug: string };

type AuthResult = {
  orgId?: string | null;
  orgSlug?: string | null;
  sessionClaims?: {
    last_active_org?: LastActiveOrg | null;
    lf_binding_status?: unknown;
  } | null;
  sessionStatus?: "active" | "pending";
  userId?: string | null;
};

const authMock = vi.fn<() => Promise<AuthResult>>();
const updateUserMetadataMock = vi.fn();

vi.mock("@vercel/microfrontends/next/middleware", () => ({
  runMicrofrontendsMiddleware: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@vendor/security/csp", () => ({
  composeCspOptions: () => ({}),
  createAnalyticsCspDirectives: () => ({}),
  createClerkCspDirectives: () => ({}),
  createNextjsCspDirectives: () => ({}),
  createSentryCspDirectives: () => ({}),
}));

vi.mock("@vendor/security/middleware", () => ({
  securityMiddleware: () => () => Promise.resolve(new Response(null)),
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
  createRouteMatcher: (patterns: string[]) => {
    return (req: RequestLike) => {
      const pathname = req.nextUrl.pathname;
      return patterns.some((pattern) => matchesPattern(pattern, pathname));
    };
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

  it("does not change the response when the background metadata merge fails", async () => {
    updateUserMetadataMock.mockRejectedValue(new Error("clerk unavailable"));

    const { event, response } = await invoke("/acme");

    expect(response.status).toBe(200);
    expect(event.waitUntil).toHaveBeenCalledTimes(1);
    await expect(event.waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
  });
});
