import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isAppOwnedApiRoute } from "../start";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app start middleware", () => {
  it("protects server function requests with TanStack CSRF middleware", () => {
    const startSource = source("src/start.ts");

    expect(startSource).toContain("createCsrfMiddleware");
    expect(startSource).toContain('ctx.handlerType === "serverFn"');
    expect(startSource).toContain("csrfMiddleware");
    expect(startSource).toContain("requestMiddleware: [");
    expect(startSource).toContain(
      "sentryGlobalRequestMiddleware,\n    csrfMiddleware,"
    );
  });

  it("classifies app-owned API routes that handle their own auth", () => {
    expect(isAppOwnedApiRoute("/api/connectors/x/mcp")).toBe(true);
    expect(isAppOwnedApiRoute("/api/connectors/x/mcp/messages")).toBe(true);
    expect(isAppOwnedApiRoute("/api/inngest")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/audit")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/auth")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/auth/validate")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/proxy/call")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/proxy/find")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/signals")).toBe(true);
    expect(isAppOwnedApiRoute("/api/internal/mcp/signals/get")).toBe(true);
    expect(isAppOwnedApiRoute("/api/v1/orgs")).toBe(true);
  });

  it("keeps Clerk on browser routes, CLI/desktop RPC, and OAuth callbacks", () => {
    expect(isAppOwnedApiRoute("/lightfast/connectors")).toBe(false);
    expect(isAppOwnedApiRoute("/api/cli/rpc")).toBe(false);
    expect(isAppOwnedApiRoute("/api/connectors/x/oauth/callback")).toBe(false);
    expect(isAppOwnedApiRoute("/api/connectors/linear/oauth/callback")).toBe(
      false
    );
    expect(isAppOwnedApiRoute("/api/desktop/rpc")).toBe(false);
    expect(isAppOwnedApiRoute("/api/github/oauth/callback")).toBe(false);
    expect(isAppOwnedApiRoute("/api/github/webhook")).toBe(false);
    expect(isAppOwnedApiRoute("/api/internal/other")).toBe(false);
  });
});
