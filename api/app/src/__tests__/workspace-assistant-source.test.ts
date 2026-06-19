import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const apiRoot = resolve(repoRoot, "api/app/src");

describe("workspace assistant TanStack migration", () => {
  it("exports assistant server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/assistant");
  });

  it("does not expose workspace assistant over tRPC", () => {
    expect(existsSync(resolve(apiRoot, "root.ts"))).toBe(false);
  });

  it("defines assistant server functions in the api/app adapter layer", () => {
    const adapterPath = resolve(apiRoot, "adapters/tanstack/assistant.ts");

    expect(existsSync(adapterPath)).toBe(true);

    const adapterSource = readFileSync(adapterPath, "utf8");
    expect(adapterSource).toMatch(
      /import\s+\{\s*createServerFn\s*\}\s+from\s+"@tanstack\/react-start"/
    );
    expect(adapterSource).toMatch(
      /export\s+const\s+listConversations\s*=\s*createServerFn/
    );
    expect(adapterSource).toMatch(
      /export\s+const\s+getConversation\s*=\s*createServerFn/
    );
    expect(adapterSource).toMatch(
      /export\s+const\s+createConversation\s*=\s*createServerFn/
    );
    expect(adapterSource).not.toContain(
      "createNewWorkspaceAssistantConversationId"
    );
    expect(adapterSource).not.toContain("TRPCError");
  });

  it("preserves domain error codes for TanStack callers", () => {
    const adapterPath = resolve(apiRoot, "adapters/tanstack/assistant.ts");
    const adapterSource = readFileSync(adapterPath, "utf8");

    expect(adapterSource).toMatch(/mappedError\.code\s*=\s*error\.code/);
    expect(adapterSource).toMatch(/code:\s*error\.code/);
    expect(adapterSource).toMatch(/kind:\s*error\.kind/);
  });
});
