import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(desktopRoot, path), "utf8");
}

describe("desktop native auth boundary", () => {
  it("keeps OAuth credentials out of the renderer bridge contract", () => {
    const ipcSource = source("src/shared/ipc.ts");
    const preloadSource = source("src/preload/build-bridge.ts");

    expect(ipcSource).not.toContain("authGetToken");
    expect(ipcSource).not.toContain("authGetRequestHeaders");
    expect(ipcSource).not.toContain("getToken:");
    expect(ipcSource).not.toContain("getRequestHeaders:");
    expect(ipcSource).not.toContain("Authorization?:");
    expect(ipcSource).not.toContain("signIn: () => Promise<string | null>");
    expect(preloadSource).not.toContain("authGetToken");
    expect(preloadSource).not.toContain("authGetRequestHeaders");
    expect(preloadSource).not.toContain("getRequestHeaders");

    const flowSource = source("src/main/native-auth/flow.ts");
    const appShellSource = source("src/renderer/src/react/app-shell.tsx");
    expect(flowSource).not.toContain("return tokens.accessToken");
    expect(flowSource).not.toContain("Promise<string | null>");
    expect(appShellSource).not.toContain(".then((token)");
  });

  it("exposes a typed desktop API bridge over IPC", () => {
    const ipcSource = source("src/shared/ipc.ts");
    const preloadSource = source("src/preload/build-bridge.ts");
    const mainSource = source("src/main/index.ts");

    expect(ipcSource).toContain("desktopApiCall");
    expect(ipcSource).toContain("DesktopApiBridge");
    expect(ipcSource).toContain("DesktopApiCommandMap");
    expect(ipcSource).toContain("api: DesktopApiBridge");
    expect(preloadSource).toContain("api: {");
    expect(preloadSource).toContain("IpcChannels.desktopApiCall");
    expect(mainSource).toContain("IpcChannels.desktopApiCall");
  });

  it("removes the unused desktop renderer tRPC client", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const entrySource = source("src/renderer/src/react/entry.tsx");

    expect(packageJson.dependencies?.["@api/app"]).toBeUndefined();
    expect(packageJson.dependencies?.["@trpc/client"]).toBeUndefined();
    expect(
      packageJson.dependencies?.["@trpc/tanstack-react-query"]
    ).toBeUndefined();
    expect(entrySource).toContain("DesktopQueryProvider");
    expect(entrySource).not.toContain("DesktopTRPCProvider");

    for (const file of [
      "src/renderer/src/react/entry.tsx",
      "src/renderer/src/react/query-provider.tsx",
    ]) {
      const fileSource = source(file);
      expect(fileSource).not.toContain("@api/app");
      expect(fileSource).not.toContain("@trpc/");
      expect(fileSource).not.toContain("/api/trpc");
      expect(fileSource).not.toContain("getRequestHeaders");
    }
  });
});
