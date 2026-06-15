import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "../security/headers";

describe("security headers", () => {
  it("adds the app security headers to a Fetch response", async () => {
    const response = applySecurityHeaders(Response.json({ ok: true }));

    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "connect-src 'self'"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://*.clerk.accounts.dev"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://js.stripe.com"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://*.js.stripe.com"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://hooks.stripe.com"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://api.stripe.com"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "wss://127.0.0.1:*"
    );
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "wss://*.lightfast.localhost"
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves response status and existing headers", () => {
    const response = applySecurityHeaders(
      new Response("missing", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
