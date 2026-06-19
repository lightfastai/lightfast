import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Automation } from "~/automations/automations-cache";
import { automationQueryKeys } from "~/automations/automations-cache";
import {
  automationPauseMutationOptions,
  automationResumeMutationOptions,
  automationRunNowMutationOptions,
  automationUpdateMutationOptions,
} from "~/automations/automations-mutations";

const automationsApi = vi.hoisted(() => ({
  createAutomation: vi.fn(),
  deleteAutomation: vi.fn(),
  getAutomation: vi.fn(),
  getAutomationRun: vi.fn(),
  listAutomationRuns: vi.fn(),
  listAutomations: vi.fn(),
  pauseAutomation: vi.fn(),
  resumeAutomation: vi.fn(),
  runAutomationNow: vi.fn(),
  updateAutomation: vi.fn(),
}));

vi.mock("@api/app/tanstack/automations", () => automationsApi);

function automation(
  publicId: string,
  status: Automation["status"] = "active"
): Automation {
  return {
    publicId,
    status,
  } as Automation;
}

describe("automation query mutation helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the canonical automation id when update variables contain a different id", async () => {
    const qc = new QueryClient();
    const existing = automation("automation_current");
    automationsApi.updateAutomation.mockResolvedValueOnce(existing);

    const options = automationUpdateMutationOptions(qc, existing.publicId, {
      errorTitle: "Failed to update",
    });

    if (!options.mutationFn) {
      throw new Error("Expected update mutation function");
    }
    await options.mutationFn(
      {
        id: "automation_other",
        name: "Renamed",
      },
      undefined as never
    );

    expect(automationsApi.updateAutomation).toHaveBeenCalledWith({
      data: { id: existing.publicId, name: "Renamed" },
    });
  });

  it("uses the canonical automation id for status and run-now mutations", async () => {
    const qc = new QueryClient();
    const existing = automation("automation_current");
    automationsApi.pauseAutomation.mockResolvedValueOnce(existing);
    automationsApi.resumeAutomation.mockResolvedValueOnce(existing);
    automationsApi.runAutomationNow.mockResolvedValueOnce({
      publicId: "automation_run_current",
    });

    const pauseOptions = automationPauseMutationOptions({
      automation: existing,
      queryClient: qc,
    });
    const resumeOptions = automationResumeMutationOptions({
      automation: existing,
      queryClient: qc,
    });
    const runNowOptions = automationRunNowMutationOptions({
      automationId: existing.publicId,
      queryClient: qc,
    });
    if (
      !(
        pauseOptions.mutationFn &&
        resumeOptions.mutationFn &&
        runNowOptions.mutationFn
      )
    ) {
      throw new Error("Expected automation mutation functions");
    }

    await pauseOptions.mutationFn(
      { id: "automation_other" },
      undefined as never
    );
    await resumeOptions.mutationFn(
      { id: "automation_other" },
      undefined as never
    );
    await runNowOptions.mutationFn(
      { id: "automation_other" },
      undefined as never
    );

    expect(automationsApi.pauseAutomation).toHaveBeenCalledWith({
      data: { id: existing.publicId },
    });
    expect(automationsApi.resumeAutomation).toHaveBeenCalledWith({
      data: { id: existing.publicId },
    });
    expect(automationsApi.runAutomationNow).toHaveBeenCalledWith({
      data: { id: existing.publicId },
    });
  });

  it("removes optimistic status caches after a cold-cache mutation fails", async () => {
    const qc = new QueryClient();
    const existing = automation("automation_current");
    const options = automationPauseMutationOptions({
      automation: existing,
      queryClient: qc,
    });
    if (!(options.onMutate && options.onError)) {
      throw new Error("Expected status mutation callbacks");
    }

    const context = await options.onMutate(
      { id: existing.publicId },
      undefined as never
    );
    expect(
      qc.getQueryData<Automation>(automationQueryKeys.detail(existing.publicId))
    ).toMatchObject({ status: "paused" });

    options.onError(
      new Error("network failed"),
      { id: existing.publicId },
      context,
      undefined as never
    );

    expect(
      qc.getQueryData(automationQueryKeys.detail(existing.publicId))
    ).toBeUndefined();
    expect(qc.getQueryData(automationQueryKeys.list())).toBeUndefined();
  });
});
