import { describe, expect, it, vi } from "vitest";

const routeHandlers = {
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
};
const serveMock = vi.fn(() => routeHandlers);
const inngestClient = { id: "app-inngest-client" };
const systemHealth = { id: "system-health" };
const classifySignal = { id: "classify-signal" };
const classifyPeople = { id: "classify-people" };
const cleanupDeveloperSandboxRuns = { id: "cleanup-developer-sandbox-runs" };
const automationScheduler = { id: "automation-scheduler" };
const runAutomation = { id: "run-automation" };
const refreshSkillIndex = { id: "refresh-skill-index" };
const refreshIdentityIndex = { id: "refresh-identity-index" };
const reconcileSkillIndexes = { id: "reconcile-skill-indexes" };
const reconcileIdentityIndexes = { id: "reconcile-identity-indexes" };
const teamMemberReconciler = { id: "team-member-reconciler" };
const queueLightfastIndexRefreshesFromSourceControl = {
  id: "queue-lightfast-index-refreshes-from-source-control",
};

vi.mock("inngest/next", () => ({
  serve: serveMock,
}));

vi.mock("../env", () => ({
  env: {
    INNGEST_SERVE_ORIGIN: "https://lightfast.localhost",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: inngestClient,
}));

vi.mock("../inngest/workflow/system-health", () => ({
  systemHealth,
}));

vi.mock("../inngest/workflow/classify-signal", () => ({
  classifySignal,
}));

vi.mock("../inngest/workflow/classify-people", () => ({
  classifyPeople,
}));

vi.mock("../inngest/workflow/cleanup-developer-sandbox-runs", () => ({
  cleanupDeveloperSandboxRuns,
}));

vi.mock("../inngest/workflow/automation-scheduler", () => ({
  automationScheduler,
}));

vi.mock("../inngest/workflow/run-automation", () => ({
  runAutomation,
}));

vi.mock("../inngest/workflow/refresh-skill-index", () => ({
  refreshSkillIndex,
}));

vi.mock("../inngest/workflow/refresh-identity-index", () => ({
  refreshIdentityIndex,
}));

vi.mock("../inngest/workflow/reconcile-skill-indexes", () => ({
  reconcileSkillIndexes,
}));

vi.mock("../inngest/workflow/reconcile-identity-indexes", () => ({
  reconcileIdentityIndexes,
}));

vi.mock("../inngest/workflow/team-member-reconciler", () => ({
  teamMemberReconciler,
}));

vi.mock("../inngest/workflow/queue-skill-refresh-from-source-control", () => ({
  queueLightfastIndexRefreshesFromSourceControl,
}));

const { createInngestRouteContext, inngest } = await import("../inngest");

describe("createInngestRouteContext", () => {
  it("serves the app Inngest client with automation and health workflows", () => {
    const handlers = createInngestRouteContext();

    expect(inngest).toBe(inngestClient);
    expect(handlers).toBe(routeHandlers);
    expect(serveMock).toHaveBeenCalledWith({
      client: inngestClient,
      functions: [
        systemHealth,
        classifySignal,
        classifyPeople,
        cleanupDeveloperSandboxRuns,
        automationScheduler,
        runAutomation,
        refreshSkillIndex,
        refreshIdentityIndex,
        reconcileSkillIndexes,
        reconcileIdentityIndexes,
        teamMemberReconciler,
        queueLightfastIndexRefreshesFromSourceControl,
      ],
      serveOrigin: "https://lightfast.localhost",
      servePath: "/api/inngest",
    });
  });
});
