import { describe, expect, it } from "vitest";
import { isAppOwnedApiRoute } from "../start";

describe("app-tanstack start middleware", () => {
  it("classifies app-owned API routes that handle their own auth", () => {
    expect(isAppOwnedApiRoute("/api/connectors/x/mcp")).toBe(true);
    expect(isAppOwnedApiRoute("/api/connectors/x/mcp/messages")).toBe(true);
    expect(isAppOwnedApiRoute("/api/inngest")).toBe(true);
    expect(isAppOwnedApiRoute("/api/v1/orgs")).toBe(true);
  });

  it("keeps Clerk on browser routes, tRPC, and OAuth callbacks", () => {
    expect(isAppOwnedApiRoute("/lightfast/connectors")).toBe(false);
    expect(isAppOwnedApiRoute("/api/trpc/org.workspace.connectors.list")).toBe(
      false
    );
    expect(isAppOwnedApiRoute("/api/connectors/x/oauth/callback")).toBe(false);
    expect(isAppOwnedApiRoute("/api/connectors/linear/oauth/callback")).toBe(
      false
    );
    expect(isAppOwnedApiRoute("/api/github/oauth/callback")).toBe(false);
  });
});
