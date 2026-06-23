import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

const migratedFiles = [
  "src/automations/automation-actions.tsx",
  "src/automations/automations-client.tsx",
  "src/automations/automation-create-form.tsx",
  "src/automations/automation-detail-client.tsx",
  "src/automations/automation-name-editor.tsx",
  "src/automations/automation-prompt-editor.tsx",
  "src/automations/automation-run-detail-content.tsx",
  "src/automations/automation-run-detail-sheet.tsx",
  "src/automations/automation-runs-list.tsx",
  "src/automations/automation-runs-section.tsx",
  "src/automations/automation-schedule-editor.tsx",
  "src/automations/automation-status-chip.tsx",
  "src/automations/automations-cache.ts",
  "src/automations/automations-mutations.ts",
  "src/automations/automations-model.ts",
] as const;

describe("migrated automation UI data access", () => {
  it("does not use tRPC for automation reads or mutations", () => {
    for (const file of migratedFiles) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("trpc.org.workspace.automations");
      expect(source, file).not.toContain(
        'AppRouterOutputs["org"]["workspace"]["automations"]'
      );
    }
  });

  it("inlines the single-use automations list query hook", () => {
    const hookPath = resolve(
      appRoot,
      "src/automations/use-automations-list-query.ts"
    );
    const source = readFileSync(
      resolve(appRoot, "src/automations/automations-client.tsx"),
      "utf8"
    );

    expect(existsSync(hookPath)).toBe(false);
    expect(source).toContain('@api/app/tanstack/automations"');
    expect(source).toContain("listAutomations");
    expect(source).toContain("automationQueryKeys.list()");
    expect(source).toContain("useQuery");
    expect(source).toContain('enabled: typeof window !== "undefined"');
    expect(source).not.toContain("automationsListQueryOptions");
    expect(source).not.toContain("./use-automations-list-query");
  });
});
