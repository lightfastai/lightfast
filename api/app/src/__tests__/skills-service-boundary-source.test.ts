import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("skills service boundary", () => {
  it("pins app-facing and workflow imports to concrete skills service modules", () => {
    const tanstackSource = source("adapters/tanstack/skills.ts");
    const chatRouteSource = source(
      "adapters/internal/workspace-assistant/chat-route.ts"
    );
    const refreshWorkflowSource = source(
      "inngest/workflow/refresh-skill-index.ts"
    );
    const reconcileWorkflowSource = source(
      "inngest/workflow/reconcile-skill-indexes.ts"
    );

    expect(tanstackSource).toContain("../../services/skills/read");
    expect(tanstackSource).toContain("../../services/skills/eligibility");
    expect(tanstackSource).toContain("../../services/skills/refresh-request");
    expect(tanstackSource).not.toMatch(
      /\bfrom\s*["']\.\.\/\.\.\/services\/skills["']/
    );

    expect(chatRouteSource).toContain("../../../services/skills/read");
    expect(chatRouteSource).toContain("../../../services/skills/eligibility");
    expect(chatRouteSource).not.toMatch(
      /await\s+import\(\s*["']\.\.\/\.\.\/\.\.\/services\/skills["']\s*\)/
    );

    expect(refreshWorkflowSource).toContain("../../services/skills/refresh");
    expect(reconcileWorkflowSource).toContain(
      "../../services/skills/reconcile"
    );
  });

  it("does not keep a broad skills service barrel", () => {
    expect(existsSync(resolve(apiRoot, "services/skills/index.ts"))).toBe(
      false
    );
  });
});
