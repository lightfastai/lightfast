import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app");

describe("account TanStack adapter boundary", () => {
  it("exports account server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/account");
  });

  it("defines handwritten account server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/account.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("getAccountProfileCommand");
    expect(source).toContain("updateAccountNameCommand");
    expect(source).toContain("createAccountUsernameCommand");
    expect(source).toContain("getGitHubAccountStatusCommand");
    expect(source).toContain("startGitHubAccountBindingCommand");
    expect(source).toContain("syncGitHubAccountCommand");
    expect(source).not.toContain("disconnectGitHubAccountCommand");
    expect(source).not.toContain("disconnectGitHubAccount = createServerFn");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
    expect(source).not.toContain("defineCommandSurface");
    expect(source).not.toContain("dispatchCommand");
  });

  it("exports account connector server functions from explicit TanStack adapters", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/mcp-connections");
    expect(packageJson.exports).toHaveProperty("./tanstack/user-connectors");

    const mcpSource = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/mcp-connections.ts"),
      "utf8"
    );
    const userConnectorSource = readFileSync(
      resolve(apiRoot, "src/adapters/tanstack/user-connectors.ts"),
      "utf8"
    );

    expect(mcpSource).toContain("listAccountMcpConnectionsCommand");
    expect(mcpSource).toContain("revokeAccountMcpConnectionCommand");
    expect(mcpSource).toContain("listOrgMcpConnectionsCommand");
    expect(mcpSource).toContain("revokeOrgMcpConnectionCommand");
    expect(userConnectorSource).toContain("startUserConnectorCommand");
    expect(userConnectorSource).toContain("disconnectUserConnectorCommand");

    for (const source of [mcpSource, userConnectorSource]) {
      expect(source).toContain("createServerFn");
      expect(source).not.toContain("TRPCError");
      expect(source).not.toContain("ORPCError");
      expect(source).not.toContain("defineCommandSurface");
      expect(source).not.toContain("dispatchCommand");
    }
  });

  it("removes migrated org MCP settings procedures from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-not-allowed)/mcp-connections.ts"
    );

    expect(rootSource).not.toContain("mcpConnections: orgMcpConnectionsRouter");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("orgMcpConnectionsRouter");
      expect(routerSource).not.toContain("orgAdminProcedure");
    }
  });

  it("removes migrated account procedures and connector routers from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-allowed)/account.ts"
    );

    expect(rootSource).not.toContain(
      "mcpConnections: accountMcpConnectionsRouter"
    );
    expect(rootSource).not.toContain("userConnectors: userConnectorsRouter");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("get: viewerProcedure");
      expect(routerSource).not.toContain("updateName: viewerProcedure");
      expect(routerSource).not.toContain("createUsername: viewerProcedure");
      expect(routerSource).not.toContain("TRPCError");
    }
  });

  it("removes migrated GitHub account procedures from tRPC", () => {
    const rootSource = readFileSync(resolve(apiRoot, "src/root.ts"), "utf8");
    const routerPath = resolve(
      apiRoot,
      "src/router/(pending-allowed)/github-account.ts"
    );

    expect(rootSource).not.toContain("githubAccount: githubAccountRouter");

    if (existsSync(routerPath)) {
      const routerSource = readFileSync(routerPath, "utf8");
      expect(routerSource).not.toContain("githubAccountRouter");
      expect(routerSource).not.toContain("viewerProcedure");
      expect(routerSource).not.toContain("TRPCRouterRecord");
    }
  });
});
