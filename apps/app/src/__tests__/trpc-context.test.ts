import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("app tRPC context bridge", () => {
  it("removes the bridge after the app tRPC route is gone", () => {
    expect(existsSync(resolve(appRoot, "src/trpc/context.ts"))).toBe(false);
  });

  it("uses the TanStack Clerk server compatibility layer", () => {
    const source = readFileSync(
      resolve(appRoot, "src/compat/clerk-server.ts"),
      "utf8"
    );

    expect(source).toContain("@clerk/tanstack-react-start/server");
    expect(source).not.toContain("not wired for app yet");
    expect(source).not.toContain('type: "unauthenticated"');
  });
});
