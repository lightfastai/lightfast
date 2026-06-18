import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("automations query helpers", () => {
  it("centralizes automation query keys and server function calls", () => {
    const source = readFileSync(
      resolve(appRoot, "src/automations/automations-queries.ts"),
      "utf8"
    );

    expect(source).toContain('from "@api/app/tanstack/automations"');
    expect(source).toContain("automationQueryKeys");
    expect(source).toContain("automationsListQueryOptions");
    expect(source).toContain("automationDetailQueryOptions");
    expect(source).toContain("automationRunsQueryOptions");
    expect(source).toContain("automationRunQueryOptions");
    expect(source).toContain("automationCreateMutationOptions");
    expect(source).toContain("automationUpdateMutationOptions");
    expect(source).toContain("automationPauseMutationOptions");
    expect(source).toContain("automationResumeMutationOptions");
    expect(source).toContain("automationDeleteMutationOptions");
    expect(source).toContain("automationRunNowMutationOptions");
    expect(source).not.toContain("useTRPC");
    expect(source).not.toContain("trpc.org.workspace.automations");
  });
});
