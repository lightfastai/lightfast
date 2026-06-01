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
const automationScheduler = { id: "automation-scheduler" };
const runAutomation = { id: "run-automation" };
const syncGitHubSourceControlRepository = {
  id: "sync-github-source-control-repository",
};
const refreshSkillIndex = { id: "refresh-skill-index" };
const reconcileSkillIndexes = { id: "reconcile-skill-indexes" };
const queueSkillRefreshFromSourceControl = {
  id: "queue-skill-refresh-from-source-control",
};

vi.mock("inngest/next", () => ({
  serve: serveMock,
}));

vi.mock("../env", () => ({
  env: {
    INNGEST_SERVE_ORIGIN: "https://app.lightfast.localhost",
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

vi.mock("../inngest/workflow/automation-scheduler", () => ({
  automationScheduler,
}));

vi.mock("../inngest/workflow/run-automation", () => ({
  runAutomation,
}));

vi.mock("../inngest/workflow/sync-source-control-repository", () => ({
  syncGitHubSourceControlRepository,
}));

vi.mock("../inngest/workflow/refresh-skill-index", () => ({
  refreshSkillIndex,
}));

vi.mock("../inngest/workflow/reconcile-skill-indexes", () => ({
  reconcileSkillIndexes,
}));

vi.mock("../inngest/workflow/queue-skill-refresh-from-source-control", () => ({
  queueSkillRefreshFromSourceControl,
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
        automationScheduler,
        runAutomation,
        syncGitHubSourceControlRepository,
        refreshSkillIndex,
        reconcileSkillIndexes,
        queueSkillRefreshFromSourceControl,
      ],
      serveOrigin: "https://app.lightfast.localhost",
      servePath: "/api/inngest",
    });
  });
});
