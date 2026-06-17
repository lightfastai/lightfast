import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("people TanStack adapter boundary", () => {
  it("exports people server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/people");
  });

  it("defines people server functions in the adapter layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/people.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("listPeopleCommand");
    expect(source).toContain("getPersonCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });
});
