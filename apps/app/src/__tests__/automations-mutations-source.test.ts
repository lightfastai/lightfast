import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("automations cache and mutation helpers", () => {
  it("keeps read queries inline while preserving cache and mutation locality", () => {
    const queriesPath = resolve(
      appRoot,
      "src/automations/automations-queries.ts"
    );
    const cacheSource = readFileSync(
      resolve(appRoot, "src/automations/automations-cache.ts"),
      "utf8"
    );
    const mutationSource = readFileSync(
      resolve(appRoot, "src/automations/automations-mutations.ts"),
      "utf8"
    );

    expect(existsSync(queriesPath)).toBe(false);
    expect(cacheSource).toContain('from "@api/app/tanstack/automations"');
    expect(cacheSource).toContain("automationQueryKeys");
    expect(cacheSource).toContain("AutomationListItem");
    expect(cacheSource).toContain("AutomationRunDetail");
    expect(cacheSource).not.toContain("queryOptions");
    expect(cacheSource).not.toContain("mutationOptions");
    expect(cacheSource).not.toContain("automationsListQueryOptions");
    expect(cacheSource).not.toContain("automationDetailQueryOptions");
    expect(cacheSource).not.toContain("automationRunsQueryOptions");
    expect(cacheSource).not.toContain("automationRunQueryOptions");
    expect(mutationSource).toContain('from "@api/app/tanstack/automations"');
    expect(mutationSource).toContain("mutationOptions");
    expect(mutationSource).toContain("automationCreateMutationOptions");
    expect(mutationSource).toContain("automationUpdateMutationOptions");
    expect(mutationSource).toContain("automationPauseMutationOptions");
    expect(mutationSource).toContain("automationResumeMutationOptions");
    expect(mutationSource).toContain("automationDeleteMutationOptions");
    expect(mutationSource).toContain("automationRunNowMutationOptions");
    expect(mutationSource).not.toContain("queryOptions");
    expect(mutationSource).not.toContain("automationsListQueryOptions");
    expect(mutationSource).not.toContain("automationDetailQueryOptions");
    expect(mutationSource).not.toContain("automationRunsQueryOptions");
    expect(mutationSource).not.toContain("automationRunQueryOptions");
    expect(mutationSource).not.toContain("listAutomations");
    expect(mutationSource).not.toContain("getAutomation");
    expect(mutationSource).not.toContain("useTRPC");
    expect(mutationSource).not.toContain("trpc.org.workspace.automations");
  });
});
