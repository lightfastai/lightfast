import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSignalEntityIndexBackfillCandidates: vi.fn(),
  vercelEnv: "production",
}));

const db = { kind: "mock-db" } as unknown as Database;

interface BackfillEventData {
  clerkOrgId: string;
  confirm: "prod";
  cursor?: number | null;
}

type WorkflowCallback = (input: {
  event: {
    data: BackfillEventData;
    id?: string;
  };
  step: ReturnType<typeof createStep>;
}) => Promise<unknown>;

let workflowCallback: WorkflowCallback | undefined;
const createFunctionMock = vi.fn(
  (_config: unknown, handler: WorkflowCallback): { id: string } => {
    workflowCallback = handler;
    return { id: "backfill-signal-entity-links" };
  }
);

vi.mock("@db/app", () => ({
  listSignalEntityIndexBackfillCandidates:
    mocks.listSignalEntityIndexBackfillCandidates,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("../env", () => ({
  env: {
    get VERCEL_ENV() {
      return mocks.vercelEnv;
    },
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { appEvents } = await import("../inngest/schemas/app");
const { backfillSignalEntityLinks } = await import(
  "../inngest/workflow/backfill-signal-entity-links"
);

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    sendEvent: vi.fn(),
  };
}

function runWorkflow(
  step: ReturnType<typeof createStep>,
  data: BackfillEventData = {
    clerkOrgId: "org_test",
    confirm: "prod",
  }
) {
  if (!workflowCallback) {
    throw new Error("workflow callback was not registered");
  }

  return workflowCallback({
    event: {
      data,
      id: "evt_backfill_test",
    },
    step,
  });
}

beforeEach(() => {
  mocks.listSignalEntityIndexBackfillCandidates.mockReset();
  mocks.vercelEnv = "production";
  mocks.listSignalEntityIndexBackfillCandidates.mockResolvedValue({
    items: [
      {
        id: 11,
        publicId: "signal_111e4567-e89b-12d3-a456-426614174000",
      },
      {
        id: 12,
        publicId: "signal_222e4567-e89b-12d3-a456-426614174000",
      },
    ],
    nextCursor: null,
  });
});

describe("backfillSignalEntityLinks", () => {
  it("registers the prod-confirmed backfill workflow and event schema", () => {
    expect(backfillSignalEntityLinks).toEqual({
      id: "backfill-signal-entity-links",
    });
    expect(appEvents["app/signal.entity-index.backfill.requested"]).toEqual(
      expect.objectContaining({
        event: "app/signal.entity-index.backfill.requested",
      })
    );
    expect(() =>
      appEvents["app/signal.entity-index.backfill.requested"].schema.parse({
        clerkOrgId: "org_test",
        confirm: "prod",
      })
    ).not.toThrow();
    expect(() =>
      appEvents["app/signal.entity-index.backfill.requested"].schema.parse({
        clerkOrgId: "org_test",
        confirm: "preview",
      })
    ).toThrow();
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "backfill-signal-entity-links",
        idempotency: "event.id",
        retries: 1,
        timeouts: { finish: "10m", start: "2m" },
        triggers: expect.objectContaining({
          event: "app/signal.entity-index.backfill.requested",
        }),
      },
      expect.any(Function)
    );
  });

  it("skips outside production even with a prod confirmation token", async () => {
    mocks.vercelEnv = "preview";
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      deploymentEnvironment: "preview",
      status: "skipped_non_production",
    });

    expect(
      mocks.listSignalEntityIndexBackfillCandidates
    ).not.toHaveBeenCalled();
    expect(step.sendEvent).not.toHaveBeenCalled();
  });

  it("skips without the explicit prod confirmation token", async () => {
    const step = createStep();

    await expect(
      runWorkflow(step, { clerkOrgId: "org_test" } as BackfillEventData)
    ).resolves.toEqual({
      status: "skipped_missing_prod_confirmation",
    });

    expect(
      mocks.listSignalEntityIndexBackfillCandidates
    ).not.toHaveBeenCalled();
    expect(step.sendEvent).not.toHaveBeenCalled();
  });

  it("queues entity indexing for eligible production signals", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      nextCursor: null,
      signalsQueued: 2,
      status: "queued",
    });

    expect(mocks.listSignalEntityIndexBackfillCandidates).toHaveBeenCalledWith(
      db,
      {
        clerkOrgId: "org_test",
        cursor: null,
        limit: 100,
      }
    );
    expect(step.sendEvent).toHaveBeenCalledTimes(1);
    expect(step.sendEvent).toHaveBeenCalledWith("queue signal entity indexes", [
      {
        name: "app/signal.entity-index.requested",
        data: {
          clerkOrgId: "org_test",
          signalId: "signal_111e4567-e89b-12d3-a456-426614174000",
        },
      },
      {
        name: "app/signal.entity-index.requested",
        data: {
          clerkOrgId: "org_test",
          signalId: "signal_222e4567-e89b-12d3-a456-426614174000",
        },
      },
    ]);
  });

  it("continues from the returned cursor", async () => {
    mocks.listSignalEntityIndexBackfillCandidates.mockResolvedValueOnce({
      items: [
        {
          id: 12,
          publicId: "signal_222e4567-e89b-12d3-a456-426614174000",
        },
      ],
      nextCursor: 12,
    });
    const step = createStep();

    await expect(
      runWorkflow(step, {
        clerkOrgId: "org_test",
        confirm: "prod",
        cursor: 7,
      })
    ).resolves.toEqual({
      nextCursor: 12,
      signalsQueued: 1,
      status: "queued",
    });

    expect(mocks.listSignalEntityIndexBackfillCandidates).toHaveBeenCalledWith(
      db,
      {
        clerkOrgId: "org_test",
        cursor: 7,
        limit: 100,
      }
    );
    expect(step.sendEvent).toHaveBeenCalledWith(
      "continue signal entity backfill",
      {
        name: "app/signal.entity-index.backfill.requested",
        data: {
          clerkOrgId: "org_test",
          confirm: "prod",
          cursor: 12,
        },
      }
    );
  });
});
