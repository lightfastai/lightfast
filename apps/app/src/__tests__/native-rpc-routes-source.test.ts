import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const appRoot = resolve(repoRoot, "apps/app");

function appSource(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("native RPC route boundaries", () => {
  it("mounts desktop and CLI RPC endpoints as thin app-owned route files", () => {
    const desktopPath = resolve(appRoot, "src/routes/api/desktop/rpc.ts");
    const cliPath = resolve(appRoot, "src/routes/api/cli/rpc.ts");

    expect(existsSync(desktopPath)).toBe(true);
    expect(existsSync(cliPath)).toBe(true);

    const desktopRoute = appSource("src/routes/api/desktop/rpc.ts");
    const cliRoute = appSource("src/routes/api/cli/rpc.ts");

    expect(desktopRoute).toContain('createFileRoute("/api/desktop/rpc")');
    expect(desktopRoute).toContain("await import(");
    expect(desktopRoute).toContain('"@api/app/desktop-api"');
    expect(desktopRoute).not.toContain(
      'import { handleDesktopNativeRpcRequest } from "@api/app/desktop-api"'
    );
    expect(desktopRoute).toContain("handleDesktopNativeRpcRequest");
    expect(cliRoute).toContain('createFileRoute("/api/cli/rpc")');
    expect(cliRoute).toContain("await import(");
    expect(cliRoute).toContain('"@api/app/cli-api"');
    expect(cliRoute).not.toContain(
      'import { handleCliNativeRpcRequest } from "@api/app/cli-api"'
    );
    expect(cliRoute).toContain("handleCliNativeRpcRequest");

    for (const source of [desktopRoute, cliRoute]) {
      expect(source).not.toContain("getNativeAuthSessionForRequest");
      expect(source).not.toContain("@db/app");
      expect(source).not.toContain("@repo/provider-routine");
      expect(source).not.toContain("resolveAuthContextFromClerk");
    }
  });

  it("keeps native RPC behavior in explicit api/app adapter entrypoints", () => {
    const packageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports?: Record<string, unknown>;
    };
    const desktopAdapter = repoSource("api/app/src/adapters/desktop-api.ts");
    const cliAdapter = repoSource("api/app/src/adapters/cli-api.ts");
    const sharedAdapter = repoSource("api/app/src/adapters/native-rpc.ts");

    expect(packageJson.exports).toHaveProperty("./desktop-api");
    expect(packageJson.exports).toHaveProperty("./cli-api");
    expect(desktopAdapter).toContain("desktopNativeRpcCommands");
    expect(desktopAdapter).toContain('"auth.session"');
    expect(desktopAdapter).toContain('source: "desktop"');
    expect(cliAdapter).toContain("cliNativeRpcCommands");
    expect(cliAdapter).toContain('"auth.session"');
    expect(cliAdapter).toContain('"providerRoutines.find"');
    expect(cliAdapter).toContain('"providerRoutines.call"');
    expect(cliAdapter).toContain('source: "cli"');
    expect(sharedAdapter).toContain("resolveAuthContextFromClerk");
    expect(sharedAdapter).toContain("NATIVE_AUTH_HEADERS");
    expect(sharedAdapter).toContain("getNativeAuthSessionForNativeOAuth");
    expect(sharedAdapter).not.toContain("getNativeAuthSessionForRequest");
    expect(sharedAdapter).toContain("nativeRpcRequestSchema");
    expect(sharedAdapter).toContain("nativeRpcAuthSessionInputSchema");
    expect(sharedAdapter).not.toContain("/api/v1/rpc");
  });

  it("removes legacy native provider proxy routes after CLI RPC covers provider routines", () => {
    expect(
      existsSync(resolve(appRoot, "src/routes/api/native/proxy/call.ts"))
    ).toBe(false);
    expect(
      existsSync(resolve(appRoot, "src/routes/api/native/proxy/routines.ts"))
    ).toBe(false);

    const cliAdapter = repoSource("api/app/src/adapters/cli-api.ts");
    const packageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports?: Record<string, unknown>;
    };
    const routeTree = appSource("src/routeTree.gen.ts");

    expect(packageJson.exports).toHaveProperty("./cli-api");
    expect(packageJson.exports).not.toHaveProperty("./native-provider-proxy");
    expect(routeTree).not.toContain("/api/native/proxy");
    expect(cliAdapter).toContain("createCliProviderRoutineContext");
    expect(cliAdapter).toContain("loadAgentConnectorRuntimeTools");
    expect(cliAdapter).toContain('sourceSurface: "native_cli"');
    expect(cliAdapter).not.toContain("handleCliProviderRoutineFindRequest");
    expect(cliAdapter).not.toContain("handleCliProviderRoutineCallRequest");
  });
});
