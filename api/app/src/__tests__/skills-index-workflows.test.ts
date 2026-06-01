import { beforeEach, describe, expect, it, vi } from "vitest";

const logWarnMock = vi.fn();
const completeWatchedSourceControlRepositorySetupMock = vi.fn();
const createGitHubAppJwtMock = vi.fn();
const createGitHubInstallationTokenMock = vi.fn();
const getActiveOrgBindingMock = vi.fn();
const getGitHubRepositoryMock = vi.fn();
const mirrorOrgSetupGateMock = vi.fn();
const markDeliveryMock = vi.fn();
const findChangedSkillIndexSourcesMock = vi.fn();
const refreshSkillIndexSourceMock = vi.fn();
const reconcileSkillIndexSourcesMock = vi.fn();
const sendMock = vi.fn();
const upsertWatchedSourceControlRepositoryMock = vi.fn();
const verifyGitHubInstallationRepositoryMock = vi.fn();

type Step = ReturnType<typeof createStep>;
type RefreshCallback = (input: {
  event: {
    data: {
      dedupeKey: string;
      reason: "schedule" | "setup" | "webhook";
      sourceControlRepositoryId: number;
      targetCommitSha?: string;
    };
  };
  step: Step;
}) => Promise<unknown>;
type ReconcileCallback = (input: { step: Step }) => Promise<unknown>;
type QueueCallback = (input: {
  event: {
    data: {
      afterSha: string;
      changedPaths: string[];
      changedPathsComplete: boolean;
      deliveryId: string;
      ref: string;
      repositoryWatchId: number;
    };
  };
  step: Step;
}) => Promise<unknown>;
type QueueFailureCallback = (input: {
  event: { data: { event: { data: { deliveryId: string } } } };
  step: Step;
}) => Promise<unknown>;
interface FunctionConfig {
  id: string;
  onFailure?: QueueFailureCallback;
  [key: string]: unknown;
}

let refreshCallback: RefreshCallback | undefined;
let reconcileCallback: ReconcileCallback | undefined;
let queueCallback: QueueCallback | undefined;
let queueConfig: FunctionConfig | undefined;

const createFunctionMock = vi.fn(
  (
    config: FunctionConfig,
    handler: RefreshCallback | ReconcileCallback | QueueCallback
  ): { id: string } => {
    if (config.id === "refresh-skill-index") {
      refreshCallback = handler as RefreshCallback;
    }
    if (config.id === "reconcile-skill-indexes") {
      reconcileCallback = handler as ReconcileCallback;
    }
    if (config.id === "queue-skill-refresh-from-source-control") {
      queueConfig = config;
      queueCallback = handler as QueueCallback;
    }
    return { id: config.id };
  }
);

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  completeWatchedSourceControlRepositorySetup:
    completeWatchedSourceControlRepositorySetupMock,
  getActiveOrgBinding: getActiveOrgBindingMock,
  markSourceControlWebhookDeliveryStatus: markDeliveryMock,
  upsertWatchedSourceControlRepository:
    upsertWatchedSourceControlRepositoryMock,
}));

vi.mock("@repo/github-app-node", () => ({
  createGitHubAppJwt: createGitHubAppJwtMock,
  createGitHubInstallationToken: createGitHubInstallationTokenMock,
  getGitHubRepository: getGitHubRepositoryMock,
  verifyGitHubInstallationRepository: verifyGitHubInstallationRepositoryMock,
}));

vi.mock("../auth/org-binding-mirror", () => ({
  mirrorOrgSetupGate: mirrorOrgSetupGateMock,
}));

vi.mock("../env", () => ({
  env: {
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: "github_client_test",
    GITHUB_APP_CLIENT_SECRET: "github_secret_test",
    GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
    GITHUB_APP_ID: "12345",
    GITHUB_APP_PRIVATE_KEY: "test-private-key",
    GITHUB_APP_SLUG: "lightfast-test",
    INNGEST_APP_NAME: "app-test",
    INNGEST_EVENT_KEY: "event-key-test",
    VERCEL_ENV: "development",
  },
}));

vi.mock("@vendor/observability/inngest", () => ({
  createInngestObservabilityMiddleware: () => ({}),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: logWarnMock,
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
    send: sendMock,
  },
}));

vi.mock("../services/skills", () => ({
  findChangedSkillIndexSources: findChangedSkillIndexSourcesMock,
  reconcileSkillIndexSources: reconcileSkillIndexSourcesMock,
  refreshSkillIndexSource: refreshSkillIndexSourceMock,
}));

const { refreshSkillIndex } = await import(
  "../inngest/workflow/refresh-skill-index"
);
const { reconcileSkillIndexes } = await import(
  "../inngest/workflow/reconcile-skill-indexes"
);
const { queueSkillRefreshFromSourceControl, shouldQueueSkillRefreshFromPush } =
  await import("../inngest/workflow/queue-skill-refresh-from-source-control");
const { verifyGitHubLightfastRepositorySetup } = await import(
  "../services/github/setup/lightfast-repository"
);

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    sendEvent: vi.fn((_name: string, event: unknown) =>
      Promise.resolve({ ids: ["event_test"], event })
    ),
  };
}

function runRefresh(step: Step) {
  if (!refreshCallback) {
    throw new Error("refresh callback was not registered");
  }
  return refreshCallback({
    event: {
      data: {
        dedupeKey: "9-abc123",
        reason: "webhook",
        sourceControlRepositoryId: 9,
        targetCommitSha: "abc123",
      },
    },
    step,
  });
}

function runReconcile(step: Step) {
  if (!reconcileCallback) {
    throw new Error("reconcile callback was not registered");
  }
  return reconcileCallback({ step });
}

function runQueue(step: Step, input: { changedPaths: string[]; ref: string }) {
  if (!queueCallback) {
    throw new Error("queue callback was not registered");
  }
  return queueCallback({
    event: {
      data: {
        afterSha: "abc123",
        changedPaths: input.changedPaths,
        deliveryId: "delivery_1",
        ref: input.ref,
        repositoryWatchId: 9,
        changedPathsComplete: true,
      },
    },
    step,
  });
}

beforeEach(() => {
  logWarnMock.mockReset();
  completeWatchedSourceControlRepositorySetupMock.mockReset();
  createGitHubAppJwtMock.mockReset();
  createGitHubInstallationTokenMock.mockReset();
  getActiveOrgBindingMock.mockReset();
  getGitHubRepositoryMock.mockReset();
  mirrorOrgSetupGateMock.mockReset();
  markDeliveryMock.mockReset();
  findChangedSkillIndexSourcesMock.mockReset();
  refreshSkillIndexSourceMock.mockReset();
  reconcileSkillIndexSourcesMock.mockReset();
  sendMock.mockReset();
  upsertWatchedSourceControlRepositoryMock.mockReset();
  verifyGitHubInstallationRepositoryMock.mockReset();

  completeWatchedSourceControlRepositorySetupMock.mockResolvedValue({
    id: 42,
  });
  createGitHubAppJwtMock.mockResolvedValue("app.jwt");
  createGitHubInstallationTokenMock.mockResolvedValue({
    token: "ghs_installation",
  });
  getActiveOrgBindingMock.mockResolvedValue({
    id: 7,
    metadata: {
      events: ["push"],
      permissions: { contents: "read" },
    },
    provider: "github",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
  });
  getGitHubRepositoryMock.mockResolvedValue({
    fullName: "acme/.lightfast",
    id: "987",
    name: ".lightfast",
    owner: "acme",
  });
  mirrorOrgSetupGateMock.mockResolvedValue(undefined);
  markDeliveryMock.mockResolvedValue(true);
  findChangedSkillIndexSourcesMock.mockResolvedValue({
    changed: [
      {
        sourceControlRepositoryId: 42,
        targetCommitSha: "def456",
      },
    ],
    checked: 1,
  });
  refreshSkillIndexSourceMock.mockResolvedValue({ status: "fresh" });
  reconcileSkillIndexSourcesMock.mockResolvedValue({ checked: 1, queued: 1 });
  sendMock.mockResolvedValue({ ids: ["event_setup"] });
  upsertWatchedSourceControlRepositoryMock.mockResolvedValue({ id: 42 });
  verifyGitHubInstallationRepositoryMock.mockResolvedValue({
    installationId: "1001",
  });
});

describe("skills index Inngest workflows", () => {
  it("registers the refresh workflow and calls the shared service", async () => {
    expect(refreshSkillIndex).toEqual({ id: "refresh-skill-index" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "refresh-skill-index",
        idempotency: "event.data.dedupeKey",
        retries: 2,
        timeouts: { finish: "30s", start: "2m" },
        triggers: expect.objectContaining({
          event: "app/skills.index.refresh.requested",
        }),
      },
      expect.any(Function)
    );

    const step = createStep();
    await runRefresh(step);

    expect(step.run).toHaveBeenCalledWith(
      "refresh skill index source",
      expect.any(Function)
    );
    expect(refreshSkillIndexSourceMock).toHaveBeenCalledWith({
      reason: "webhook",
      sourceControlRepositoryId: 9,
      targetCommitSha: "abc123",
    });
  });

  it("accepts only main branch pushes with skills changes", () => {
    expect(
      shouldQueueSkillRefreshFromPush({
        changedPaths: ["skills/demo/SKILL.md"],
        changedPathsComplete: true,
        ref: "refs/heads/main",
      })
    ).toBe(true);
    expect(
      shouldQueueSkillRefreshFromPush({
        changedPaths: ["skills/demo/SKILL.md"],
        changedPathsComplete: true,
        ref: "refs/heads/feature",
      })
    ).toBe(false);
    expect(
      shouldQueueSkillRefreshFromPush({
        changedPaths: ["docs/demo.md"],
        changedPathsComplete: true,
        ref: "refs/heads/main",
      })
    ).toBe(false);
    expect(
      shouldQueueSkillRefreshFromPush({
        changedPaths: ["docs/demo.md"],
        changedPathsComplete: false,
        ref: "refs/heads/main",
      })
    ).toBe(true);
    expect(
      shouldQueueSkillRefreshFromPush({
        changedPaths: ["docs/demo.md"],
        changedPathsComplete: false,
        ref: "refs/heads/feature",
      })
    ).toBe(false);
  });

  it("queues a webhook refresh from matching source control pushes", async () => {
    const step = createStep();

    await expect(
      runQueue(step, {
        changedPaths: ["skills/demo/SKILL.md"],
        ref: "refs/heads/main",
      })
    ).resolves.toEqual({ queued: true });

    expect(queueSkillRefreshFromSourceControl).toEqual({
      id: "queue-skill-refresh-from-source-control",
    });
    expect(createFunctionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "queue-skill-refresh-from-source-control",
        idempotency: "event.data.deliveryId",
        retries: 1,
        timeouts: { finish: "30s", start: "2m" },
      }),
      expect.any(Function)
    );
    expect(step.sendEvent).toHaveBeenCalledWith("queue skill index refresh", {
      name: "app/skills.index.refresh.requested",
      data: {
        dedupeKey: "9-abc123",
        reason: "webhook",
        sourceControlRepositoryId: 9,
        targetCommitSha: "abc123",
      },
    });
    expect(markDeliveryMock).toHaveBeenCalledWith(expect.anything(), {
      deliveryId: "delivery_1",
      status: "processed",
    });
  });

  it("marks source control deliveries failed when queueing exhausts retries", async () => {
    if (!queueConfig?.onFailure) {
      throw new Error("queue onFailure callback was not registered");
    }
    const step = createStep();

    await expect(
      queueConfig.onFailure({
        event: {
          data: {
            event: {
              data: {
                deliveryId: "delivery_1",
              },
            },
          },
        },
        step,
      })
    ).resolves.toEqual({ status: "failed" });

    expect(markDeliveryMock).toHaveBeenCalledWith(expect.anything(), {
      deliveryId: "delivery_1",
      status: "failed",
    });
  });

  it("registers reconcile on an hourly cron and sends refresh events from explicit durable steps", async () => {
    expect(reconcileSkillIndexes).toEqual({ id: "reconcile-skill-indexes" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "reconcile-skill-indexes",
        retries: 1,
        timeouts: { finish: "5m", start: "2m" },
        triggers: { cron: "0 * * * *" },
      },
      expect.any(Function)
    );

    const step = createStep();
    await expect(runReconcile(step)).resolves.toEqual({
      checked: 1,
      queued: 1,
    });

    expect(step.run).toHaveBeenCalledWith(
      "reconcile skill index sources",
      expect.any(Function)
    );
    expect(findChangedSkillIndexSourcesMock).toHaveBeenCalledWith({
      limit: 100,
      totalLimit: 1000,
    });
    expect(reconcileSkillIndexSourcesMock).not.toHaveBeenCalled();

    expect(step.sendEvent).toHaveBeenCalledWith(
      "queue skill index refresh 42",
      {
        name: "app/skills.index.refresh.requested",
        data: {
          dedupeKey: "42-def456",
          reason: "schedule",
          sourceControlRepositoryId: 42,
          targetCommitSha: "def456",
        },
      }
    );
  });

  it("caps reconcile refresh event sends to the workflow limit", async () => {
    findChangedSkillIndexSourcesMock.mockResolvedValueOnce({
      changed: Array.from({ length: 101 }, (_, index) => ({
        sourceControlRepositoryId: index + 1,
        targetCommitSha: `sha-${index + 1}`,
      })),
      checked: 101,
    });
    const step = createStep();

    await expect(runReconcile(step)).resolves.toEqual({
      checked: 101,
      queued: 100,
    });

    expect(step.sendEvent).toHaveBeenCalledTimes(100);
    expect(step.sendEvent).toHaveBeenCalledWith(
      "queue skill index refresh 100",
      {
        name: "app/skills.index.refresh.requested",
        data: {
          dedupeKey: "100-sha-100",
          reason: "schedule",
          sourceControlRepositoryId: 100,
          targetCommitSha: "sha-100",
        },
      }
    );
    expect(step.sendEvent).not.toHaveBeenCalledWith(
      "queue skill index refresh 101",
      expect.anything()
    );
  });

  it("prewarms the initial skill refresh without blocking setup success", async () => {
    sendMock.mockRejectedValueOnce(new Error("inngest unavailable"));

    await expect(
      verifyGitHubLightfastRepositorySetup({
        clerkOrgId: "org_1",
        db: {},
      } as never)
    ).resolves.toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });

    expect(sendMock).toHaveBeenCalledWith({
      name: "app/skills.index.refresh.requested",
      data: {
        dedupeKey: "42-setup",
        reason: "setup",
        sourceControlRepositoryId: 42,
      },
    });
    expect(logWarnMock).toHaveBeenCalledWith(
      "[github-setup] initial skill refresh enqueue failed",
      expect.objectContaining({
        error: expect.any(Error),
        sourceControlRepositoryId: 42,
      })
    );
  });
});
