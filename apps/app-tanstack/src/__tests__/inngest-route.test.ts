import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app-tanstack Inngest route", () => {
  it("serves app Inngest handlers through a TanStack server route", () => {
    const routeSource = source("src/routes/api/inngest.ts");

    expect(routeSource).toContain('createFileRoute("/api/inngest")');
    expect(routeSource).toContain("createInngestRouteContext");
    expect(routeSource).toContain("handler(request, {})");
    expect(routeSource).toContain("GET:");
    expect(routeSource).toContain("POST:");
    expect(routeSource).toContain("PUT:");
    expect(routeSource).not.toContain("next/");
  });
});
