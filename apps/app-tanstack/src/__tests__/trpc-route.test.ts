import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("app-tanstack tRPC route", () => {
  it("mounts the app router through the fetch adapter with TanStack context", () => {
    const routeSource = readFileSync(
      resolve(appRoot, "src/routes/api/trpc.$.ts"),
      "utf8"
    );

    expect(routeSource).toContain('endpoint: "/api/trpc"');
    expect(routeSource).toContain('import("@api/app")');
    expect(routeSource).toContain('import("~/trpc/context")');
    expect(routeSource).not.toContain("createTRPCContext");
  });
});
