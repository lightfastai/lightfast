import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../../");
const repoRoot = resolve(appRoot, "../..");

function appSource(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("internal MCP app routes", () => {
  it("mounts MCP signal intake through explicit api/app internal handlers", () => {
    const createRoute = appSource("src/routes/api/internal/mcp/signals.ts");
    const getRoute = appSource("src/routes/api/internal/mcp/signals/get.ts");
    const authValidateRoute = appSource(
      "src/routes/api/internal/mcp/auth/validate.ts"
    );
    const auditRoute = appSource("src/routes/api/internal/mcp/audit.ts");
    const proxyCallRoute = appSource(
      "src/routes/api/internal/mcp/proxy/call.ts"
    );
    const proxyFindRoute = appSource(
      "src/routes/api/internal/mcp/proxy/find.ts"
    );
    const adapter = repoSource("api/app/src/adapters/internal/mcp-signals.ts");
    const auditAdapter = repoSource(
      "api/app/src/adapters/internal/mcp-audit.ts"
    );
    const authAdapter = repoSource("api/app/src/adapters/internal/mcp-auth.ts");
    const serviceAuthAdapter = repoSource(
      "api/app/src/adapters/internal/mcp-service-auth.ts"
    );
    const proxyAdapter = repoSource(
      "api/app/src/adapters/internal/mcp-proxy.ts"
    );
    const packageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, unknown>;
    };

    expect(packageJson.exports).toHaveProperty("./internal-api/mcp-signals");
    expect(packageJson.exports).toHaveProperty("./internal-api/mcp-audit");
    expect(packageJson.exports).toHaveProperty("./internal-api/mcp-auth");
    expect(packageJson.exports).toHaveProperty("./internal-api/mcp-proxy");
    expect(existsSync(resolve(appRoot, "src/server/mcp-service-auth.ts"))).toBe(
      false
    );
    expect(existsSync(resolve(appRoot, "src/server/mcp-proxy.ts"))).toBe(false);

    expect(createRoute).toContain('@api/app/internal-api/mcp-signals"');
    expect(createRoute).toContain("await import(");
    expect(createRoute).toContain("handleCreateMcpSignalInternalRequest");
    expect(getRoute).toContain('@api/app/internal-api/mcp-signals"');
    expect(getRoute).toContain("await import(");
    expect(getRoute).toContain("handleGetMcpSignalInternalRequest");
    expect(authValidateRoute).toContain('@api/app/internal-api/mcp-auth"');
    expect(authValidateRoute).toContain("await import(");
    expect(authValidateRoute).toContain(
      "handleValidateMcpGrantInternalRequest"
    );
    expect(auditRoute).toContain('@api/app/internal-api/mcp-audit"');
    expect(auditRoute).toContain("await import(");
    expect(auditRoute).toContain("handleRecordMcpAuditInternalRequest");
    expect(proxyCallRoute).toContain('@api/app/internal-api/mcp-proxy"');
    expect(proxyCallRoute).toContain("await import(");
    expect(proxyCallRoute).toContain("handleMcpProxyCallRequest");
    expect(proxyCallRoute).not.toContain(
      'import { handleMcpProxyCallRequest } from "@api/app/internal-api/mcp-proxy"'
    );
    expect(proxyFindRoute).toContain('@api/app/internal-api/mcp-proxy"');
    expect(proxyFindRoute).toContain("await import(");
    expect(proxyFindRoute).toContain("handleMcpProxyFindRequest");
    expect(proxyFindRoute).not.toContain(
      'import { handleMcpProxyFindRequest } from "@api/app/internal-api/mcp-proxy"'
    );

    for (const source of [
      createRoute,
      getRoute,
      authValidateRoute,
      auditRoute,
      proxyCallRoute,
      proxyFindRoute,
    ]) {
      expect(source).not.toContain("@db/app");
      expect(source).not.toContain("@repo/api-contract");
      expect(source).not.toContain("~/server/mcp-service-auth");
      expect(source).not.toContain("~/server/mcp-proxy");
      expect(source).not.toContain("verifyMcpServiceRequest");
      expect(source).not.toContain("jsonError");
      expect(source).not.toContain("@api/app/mcp-oauth/resource-access");
      expect(source).not.toContain("@api/app/signals/service");
    }

    expect(adapter).toContain('from "./mcp-service-auth"');
    expect(adapter).toContain('from "../../domain/signals"');
    expect(adapter).toContain("createSignalCommand.run");
    expect(adapter).toContain("getSignalCommand.run");
    expect(adapter).toContain("getVisibleSignalByPublicId");
    expect(adapter).not.toContain('from "../../env"');
    expect(adapter).not.toContain('from "../../signals/service"');
    expect(adapter).not.toContain("createSignalForActor");

    expect(auditAdapter).toContain('from "./mcp-service-auth"');
    expect(auditAdapter).toContain("recordMcpAuditEvent");
    expect(auditAdapter).not.toContain('from "../../env"');

    expect(authAdapter).toContain('from "./mcp-service-auth"');
    expect(authAdapter).toContain("getMcpOauthGrantByPublicId");
    expect(authAdapter).not.toContain('from "../../env"');

    expect(proxyAdapter).toContain('from "./mcp-service-auth"');
    expect(proxyAdapter).toContain("loadAgentConnectorRuntimeTools");
    expect(proxyAdapter).toContain('sourceSurface: "hosted_mcp"');
    expect(serviceAuthAdapter).toContain("process.env.SERVICE_JWT_SECRET");
    expect(serviceAuthAdapter).toContain("verifyServiceJWT");
    expect(serviceAuthAdapter).toContain('service: "apps-mcp"');
    expect(proxyAdapter).not.toContain('from "../../../apps/app"');
    expect(proxyAdapter).not.toContain('from "../../env"');
  });
});
