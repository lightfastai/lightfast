import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const apiRoot = resolve(appRoot, "../../api/app");

function appSource(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function apiSource(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("app Inngest route", () => {
  it("mounts app Inngest through the api internal adapter boundary", () => {
    const routeSource = appSource("src/routes/api/inngest.ts");
    const adapterSource = apiSource("src/adapters/internal/inngest.ts");
    const apiPackageJson = JSON.parse(apiSource("package.json")) as {
      exports: Record<string, unknown>;
    };

    expect(routeSource).toContain('createFileRoute("/api/inngest")');
    expect(routeSource).toContain("handleInngestRequest");
    expect(routeSource).toContain("await import(");
    expect(routeSource).toContain('"@api/app/internal-api/inngest"');
    expect(routeSource).not.toContain(
      'import { handleInngestRequest } from "@api/app/internal-api/inngest"'
    );
    expect(routeSource).not.toContain("@api/app/inngest");
    expect(routeSource).not.toContain("createInngestRouteContext");
    expect(routeSource).not.toContain("handler(request, {})");
    expect(routeSource).toContain("GET:");
    expect(routeSource).toContain("POST:");
    expect(routeSource).toContain("PUT:");
    expect(routeSource).not.toContain("next/");
    expect(apiPackageJson.exports["./internal-api/inngest"]).toEqual({
      default: "./src/adapters/internal/inngest.ts",
      types: "./src/adapters/internal/inngest.ts",
    });
    expect(adapterSource).toContain("createInngestRouteContext");
    expect(adapterSource).toContain("handler(request, {})");
  });
});
