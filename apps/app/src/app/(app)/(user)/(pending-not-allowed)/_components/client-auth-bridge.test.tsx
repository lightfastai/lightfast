import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const captureMessageMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

const useAuthMock = vi.fn();
vi.mock("@vendor/clerk/client", () => ({
  useAuth: () => useAuthMock(),
}));

const useSearchParamsMock = vi.fn(() => new URLSearchParams());
vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

// Import under test AFTER mocks
const { ClientAuthBridge } = await import("./client-auth-bridge");

function mockSignedInWithToken(token: string | null) {
  useAuthMock.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn(async () => token),
  });
}

function mockSignedOut() {
  useAuthMock.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    getToken: vi.fn(async () => null),
  });
}

function mockNotLoaded() {
  useAuthMock.mockReturnValue({
    isLoaded: false,
    isSignedIn: false,
    getToken: vi.fn(async () => null),
  });
}

describe("ClientAuthBridge — POST mode", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    captureExceptionMock.mockClear();
    captureMessageMock.mockClear();
    useAuthMock.mockClear();
    useSearchParamsMock.mockClear();
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("state=S1&callback=http://127.0.0.1:9999/callback")
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  it("POSTs token + state as JSON body with credentials omit, then renders success panel on 204", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));

    render(
      <ClientAuthBridge
        buildPostCallback={() => ({
          url: "http://127.0.0.1:9999/callback",
          state: "S1",
        })}
        mode="post"
        subtitle="You'll be redirected"
        title="Authenticating…"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Signed in to Lightfast")).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:9999/callback");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      token: "real-jwt",
      state: "S1",
    });
  });

  it("fires exactly one POST under React StrictMode double-invoke (didStart latch)", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));

    render(
      <StrictMode>
        <ClientAuthBridge
          buildPostCallback={() => ({
            url: "http://127.0.0.1:9999/callback",
            state: "S1",
          })}
          mode="post"
          subtitle="sub"
          title="title"
        />
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByText("Signed in to Lightfast")).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("renders Authentication Failed and captures warning when buildPostCallback returns null", async () => {
    mockSignedInWithToken("real-jwt");

    render(
      <ClientAuthBridge
        buildPostCallback={() => null}
        mode="post"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("buildPostCallback returned null"),
      expect.objectContaining({
        level: "warning",
        tags: { scope: "auth-bridge.invalid_callback" },
      })
    );
  });

  it("renders error and captures exception when fetch throws a network error", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    render(
      <ClientAuthBridge
        buildPostCallback={() => ({
          url: "http://127.0.0.1:9999/callback",
          state: "S1",
        })}
        mode="post"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({
        tags: { scope: "auth-bridge.fetch_network_error" },
      })
    );
  });

  it("renders error and captures warning on non-2xx response", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockResolvedValue(new Response("no", { status: 400 }));

    render(
      <ClientAuthBridge
        buildPostCallback={() => ({
          url: "http://127.0.0.1:9999/callback",
          state: "S1",
        })}
        mode="post"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(captureMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("non-ok"),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          scope: "auth-bridge.fetch_non_ok",
          status: "400",
        }),
      })
    );
  });

  it("renders error when getToken returns null", async () => {
    mockSignedInWithToken(null);

    render(
      <ClientAuthBridge
        buildPostCallback={() => ({
          url: "http://127.0.0.1:9999/callback",
          state: "S1",
        })}
        mode="post"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders error deterministically when Clerk reports signed-out", async () => {
    mockSignedOut();

    render(
      <ClientAuthBridge
        buildPostCallback={() => ({
          url: "http://127.0.0.1:9999/callback",
          state: "S1",
        })}
        mode="post"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stays in loading state while Clerk is not yet loaded", () => {
    mockNotLoaded();

    render(
      <ClientAuthBridge
        buildPostCallback={() => ({
          url: "http://127.0.0.1:9999/callback",
          state: "S1",
        })}
        mode="post"
        subtitle="Loading…"
        title="Authenticating…"
      />
    );

    // Neither success nor error panel should appear.
    expect(screen.queryByText("Signed in to Lightfast")).toBeNull();
    expect(screen.queryByText("Authentication Failed")).toBeNull();
    expect(screen.getByText("Authenticating…")).toBeTruthy();
  });
});

describe("ClientAuthBridge — code-redirect mode (desktop PKCE)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    captureExceptionMock.mockClear();
    captureMessageMock.mockClear();
    useAuthMock.mockClear();
    useSearchParamsMock.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  it("POSTs to /api/desktop/auth/code with PKCE body + Bearer auth, then redirects to redirectUri?code=…&state=…", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ code: "issued-code" }), { status: 200 })
    );
    const locationSpy = vi.spyOn(
      window.location,
      "href",
      "set"
    ) as unknown as ReturnType<typeof vi.fn>;

    render(
      <ClientAuthBridge
        buildExchangeRequest={() => ({
          state: "S1",
          codeChallenge: "CHAL",
          redirectUri: "lightfast-dev://auth/callback",
        })}
        mode="code-redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/desktop/auth/code");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer real-jwt",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      state: "S1",
      code_challenge: "CHAL",
      code_challenge_method: "S256",
      redirect_uri: "lightfast-dev://auth/callback",
    });

    await waitFor(() => {
      expect(locationSpy).toHaveBeenCalledWith(
        "lightfast-dev://auth/callback?code=issued-code&state=S1"
      );
    });
    locationSpy.mockRestore();
  });

  it("renders Authentication Failed and captures warning when buildExchangeRequest returns null", async () => {
    mockSignedInWithToken("real-jwt");

    render(
      <ClientAuthBridge
        buildExchangeRequest={() => null}
        mode="code-redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("buildExchangeRequest returned null"),
      expect.objectContaining({
        level: "warning",
        tags: { scope: "auth-bridge.invalid_callback" },
      })
    );
  });

  it("renders error and captures warning when /api/desktop/auth/code returns 4xx", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    );

    render(
      <ClientAuthBridge
        buildExchangeRequest={() => ({
          state: "S1",
          codeChallenge: "CHAL",
          redirectUri: "lightfast-dev://auth/callback",
        })}
        mode="code-redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(captureMessageMock).toHaveBeenCalledWith(
      expect.stringContaining("code endpoint non-ok"),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          scope: "auth-bridge.code_non_ok",
          status: "401",
        }),
      })
    );
  });

  it("renders error when fetch throws a network error during exchange POST", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    render(
      <ClientAuthBridge
        buildExchangeRequest={() => ({
          state: "S1",
          codeChallenge: "CHAL",
          redirectUri: "lightfast-dev://auth/callback",
        })}
        mode="code-redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({
        tags: { scope: "auth-bridge.code_network_error" },
      })
    );
  });

  it("renders error when response body is missing the code field", async () => {
    mockSignedInWithToken("real-jwt");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    render(
      <ClientAuthBridge
        buildExchangeRequest={() => ({
          state: "S1",
          codeChallenge: "CHAL",
          redirectUri: "lightfast-dev://auth/callback",
        })}
        mode="code-redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
  });
});

describe("ClientAuthBridge — redirect mode (CLI parity)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    captureExceptionMock.mockClear();
    captureMessageMock.mockClear();
    useAuthMock.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  it("sets window.location.href to the builder result and never fetches", async () => {
    mockSignedInWithToken("jwt-123");
    const builtUrl = "http://localhost:55555/callback?token=jwt-123&state=S";
    const locationSpy = vi.spyOn(
      window.location,
      "href",
      "set"
    ) as unknown as ReturnType<typeof vi.fn>;

    render(
      <ClientAuthBridge
        buildRedirectUrl={({ token }) =>
          `http://localhost:55555/callback?token=${token}&state=S`
        }
        mode="redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(locationSpy).toHaveBeenCalledWith(builtUrl);
    });
    locationSpy.mockRestore();
  });

  it("renders Authentication Failed when buildRedirectUrl returns null", async () => {
    mockSignedInWithToken("jwt-123");

    render(
      <ClientAuthBridge
        buildRedirectUrl={() => null}
        mode="redirect"
        subtitle="sub"
        title="title"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Authentication Failed")).toBeTruthy();
    });
  });
});
