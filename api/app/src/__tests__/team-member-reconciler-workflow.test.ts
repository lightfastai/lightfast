import { beforeEach, describe, expect, it, vi } from "vitest";

const listActiveOrgNamespaceClerkOrgIdsMock = vi.fn();
const syncTeamMembersForOrgMock = vi.fn();
const clerkClientMock = vi.fn();
const logWarnMock = vi.fn();
const db = { kind: "mock-db" };

type Step = ReturnType<typeof createStep>;
type WorkflowCallback = (input: {
  event: { data?: Record<string, unknown> };
  step: Step;
}) => Promise<unknown>;

let workflowCallback: WorkflowCallback | undefined;
const createFunctionMock = vi.fn(
  (config: { id: string }, handler: WorkflowCallback) => {
    workflowCallback = handler;
    return { id: config.id };
  }
);

vi.mock("@db/app", () => ({
  listActiveOrgNamespaceClerkOrgIds: listActiveOrgNamespaceClerkOrgIdsMock,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("@vendor/clerk/server", () => ({ clerkClient: clerkClientMock }));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    warn: logWarnMock,
  },
}));

vi.mock("../services/team-members/people-sync", () => ({
  syncTeamMembersForOrg: syncTeamMembersForOrgMock,
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { teamMemberReconciler } = await import(
  "../inngest/workflow/team-member-reconciler"
);

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    sendEvent: vi.fn((_name: string, event: unknown) =>
      Promise.resolve({ ids: ["event_test"], event })
    ),
  };
}

function runWorkflow(step: Step, data?: Record<string, unknown>) {
  if (!workflowCallback) {
    throw new Error("workflow callback was not registered");
  }

  return workflowCallback({ event: { data }, step });
}

beforeEach(() => {
  listActiveOrgNamespaceClerkOrgIdsMock.mockReset().mockResolvedValue({
    items: [{ id: 1, clerkOrgId: "org_test" }],
    nextCursor: null,
  });
  syncTeamMembersForOrgMock.mockReset().mockResolvedValue({
    clerkOrgId: "org_test",
    membersMarkedFormer: 1,
    membersSeen: 2,
    membersSkippedNoEmail: 0,
    membersUpserted: 2,
    status: "synced",
  });
  clerkClientMock.mockReset().mockResolvedValue({ clerk: true });
  logWarnMock.mockReset();
});

describe("teamMemberReconciler", () => {
  it("registers the cron workflow", () => {
    expect(teamMemberReconciler).toEqual({ id: "team-member-reconciler" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "team-member-reconciler",
        idempotency: "event.id",
        retries: 1,
        timeouts: { finish: "10m", start: "2m" },
        triggers: expect.arrayContaining([
          { cron: "*/15 * * * *" },
          expect.objectContaining({
            event: "app/team-members.reconcile.requested",
          }),
        ]),
      }),
      expect.any(Function)
    );
  });

  it("syncs active org namespace ids from durable steps and returns aggregate counts", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      membersMarkedFormer: 1,
      membersSeen: 2,
      membersSkippedNoEmail: 0,
      membersUpserted: 2,
      orgPagesChecked: 1,
      orgsChecked: 1,
      orgsFailed: 0,
    });

    expect(step.run).toHaveBeenCalledWith(
      "collect team member sync timestamp",
      expect.any(Function)
    );
    expect(step.run).toHaveBeenCalledWith(
      "list active org namespaces first",
      expect.any(Function)
    );
    expect(step.run).toHaveBeenCalledWith(
      "sync team members org_test",
      expect.any(Function)
    );
    expect(listActiveOrgNamespaceClerkOrgIdsMock).toHaveBeenCalledWith(db, {
      cursor: null,
      limit: 100,
    });
    expect(syncTeamMembersForOrgMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clerk: { clerk: true },
        clerkOrgId: "org_test",
        db,
      })
    );
    expect(
      syncTeamMembersForOrgMock.mock.calls[0]?.[0]?.syncedAt
    ).toBeInstanceOf(Date);
    expect(clerkClientMock).toHaveBeenCalledOnce();
  });

  it("logs per-org sync failures and continues with later orgs", async () => {
    listActiveOrgNamespaceClerkOrgIdsMock.mockResolvedValue({
      items: [
        { id: 1, clerkOrgId: "org_fails" },
        { id: 2, clerkOrgId: "org_ok" },
      ],
      nextCursor: null,
    });
    syncTeamMembersForOrgMock
      .mockRejectedValueOnce(new Error("clerk unavailable"))
      .mockResolvedValueOnce({
        clerkOrgId: "org_ok",
        membersMarkedFormer: 0,
        membersSeen: 1,
        membersSkippedNoEmail: 1,
        membersUpserted: 0,
        status: "synced",
      });

    await expect(runWorkflow(createStep())).resolves.toEqual({
      membersMarkedFormer: 0,
      membersSeen: 1,
      membersSkippedNoEmail: 1,
      membersUpserted: 0,
      orgPagesChecked: 1,
      orgsChecked: 1,
      orgsFailed: 1,
    });

    expect(syncTeamMembersForOrgMock).toHaveBeenCalledTimes(2);
    expect(logWarnMock).toHaveBeenCalledWith(
      "[people] team member sync failed",
      {
        clerkOrgId: "org_fails",
        errorMessage: "clerk unavailable",
      }
    );
  });

  it("queues a continuation event when the per-run page cap is reached", async () => {
    listActiveOrgNamespaceClerkOrgIdsMock.mockImplementation(
      (
        _db: unknown,
        input: {
          cursor: number | null;
          limit: number;
        }
      ) =>
        Promise.resolve({
          items: [],
          nextCursor: (input.cursor ?? 0) + 1,
        })
    );
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      membersMarkedFormer: 0,
      membersSeen: 0,
      membersSkippedNoEmail: 0,
      membersUpserted: 0,
      orgPagesChecked: 10,
      orgsChecked: 0,
      orgsFailed: 0,
    });

    expect(listActiveOrgNamespaceClerkOrgIdsMock).toHaveBeenCalledTimes(10);
    expect(step.sendEvent).toHaveBeenCalledWith(
      "continue team member reconciliation",
      {
        name: "app/team-members.reconcile.requested",
        data: {
          cursor: 10,
          syncedAtIso: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      }
    );
  });

  it("continues from a requested cursor without collecting a new timestamp", async () => {
    const step = createStep();
    await runWorkflow(step, {
      cursor: 42,
      syncedAtIso: "2026-06-06T02:00:00.000Z",
    });

    expect(listActiveOrgNamespaceClerkOrgIdsMock).toHaveBeenCalledWith(db, {
      cursor: 42,
      limit: 100,
    });
    expect(step.run).not.toHaveBeenCalledWith(
      "collect team member sync timestamp",
      expect.any(Function)
    );
    expect(syncTeamMembersForOrgMock.mock.calls[0]?.[0]?.syncedAt).toEqual(
      new Date("2026-06-06T02:00:00.000Z")
    );
  });
});
