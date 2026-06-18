import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createDeveloperSandboxRunMock = vi.fn();
const getDeveloperSandboxRunByPublicIdMock = vi.fn();
const markDeveloperSandboxRunCredentialsLoadedMock = vi.fn();
const markDeveloperSandboxRunStoppedMock = vi.fn();
const markDeveloperSandboxRunExpiredMock = vi.fn();
const markDeveloperSandboxRunCleanupFailedMock = vi.fn();
const listExpiredDeveloperSandboxRunsMock = vi.fn();
const createDeveloperSandboxCommandMock = vi.fn();
const finishDeveloperSandboxCommandMock = vi.fn();
const markDeveloperConnectionLeaseMaterializedMock = vi.fn();
const revokeDeveloperConnectionLeasesForSandboxRunMock = vi.fn();
const issueAllEnabledDeveloperConnectionLeasesMock = vi.fn();
const materializeDeveloperConnectionLeasesForSandboxRunMock = vi.fn();

vi.mock("@db/app", () => ({
  createDeveloperSandboxCommand: createDeveloperSandboxCommandMock,
  createDeveloperSandboxRun: createDeveloperSandboxRunMock,
  finishDeveloperSandboxCommand: finishDeveloperSandboxCommandMock,
  getDeveloperSandboxRunByPublicId: getDeveloperSandboxRunByPublicIdMock,
  listExpiredDeveloperSandboxRuns: listExpiredDeveloperSandboxRunsMock,
  markDeveloperConnectionLeaseMaterialized:
    markDeveloperConnectionLeaseMaterializedMock,
  markDeveloperSandboxRunCleanupFailed:
    markDeveloperSandboxRunCleanupFailedMock,
  markDeveloperSandboxRunCredentialsLoaded:
    markDeveloperSandboxRunCredentialsLoadedMock,
  markDeveloperSandboxRunExpired: markDeveloperSandboxRunExpiredMock,
  markDeveloperSandboxRunStopped: markDeveloperSandboxRunStoppedMock,
  revokeDeveloperConnectionLeasesForSandboxRun:
    revokeDeveloperConnectionLeasesForSandboxRunMock,
}));

vi.mock("../services/developer-connections", () => ({
  issueAllEnabledDeveloperConnectionLeases:
    issueAllEnabledDeveloperConnectionLeasesMock,
  materializeDeveloperConnectionLeasesForSandboxRun:
    materializeDeveloperConnectionLeasesForSandboxRunMock,
}));

const { createDeveloperSandboxRunService } = await import(
  "../services/developer-sandbox-runs"
);

function ctx() {
  return {
    auth: {
      identity: {
        type: "active" as const,
        userId: "user_admin",
        orgId: "org_acme",
        orgGate: {
          bindingStatus: "bound" as const,
          nextSetupRequirement: null,
        },
      },
    },
    db: {} as Database,
  };
}

function unauthenticatedCtx() {
  return {
    auth: {
      identity: { type: "unauthenticated" as const },
    },
    db: {} as Database,
  };
}

function sandboxRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    publicId: "developer_sandbox_run_1",
    clerkOrgId: "org_acme",
    actorUserId: "user_admin",
    workflowRunId: null,
    vercelSandboxId: "vercel_sandbox_1",
    status: "running",
    credentialsLoadedAt: null,
    expiresAt: new Date("2026-06-03T00:10:00.000Z"),
    stoppedAt: null,
    cleanupAttemptedAt: null,
    cleanupFailureCode: null,
    createdAt: new Date("2026-06-03T00:00:00.000Z"),
    updatedAt: new Date("2026-06-03T00:00:00.000Z"),
    ...overrides,
  };
}

function commandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 200,
    publicId: "developer_sandbox_command_1",
    sandboxRunId: 100,
    clerkOrgId: "org_acme",
    actorUserId: "user_admin",
    cmd: "node",
    args: ["--version"],
    cwd: null,
    status: "running",
    policyDecision: "allowed",
    policyRuleId: null,
    policyReason: null,
    exitCode: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    redactionCount: 0,
    startedAt: new Date("2026-06-03T00:00:00.000Z"),
    finishedAt: null,
    createdAt: new Date("2026-06-03T00:00:00.000Z"),
    updatedAt: new Date("2026-06-03T00:00:00.000Z"),
    ...overrides,
  };
}

function runtime(output: { stderr?: string; stdout?: string } = {}) {
  const calls = {
    create: [] as unknown[],
    destroy: [] as string[],
    exec: [] as unknown[],
    get: [] as string[],
    writeFiles: [] as unknown[],
  };
  return {
    calls,
    async create(input: unknown) {
      calls.create.push(input);
      return {
        id: "vercel_sandbox_1",
        status: "running",
        async exec(command: unknown) {
          calls.exec.push(command);
          return {
            id: "cmd_runtime_1",
            async stdout() {
              return output.stdout ?? "";
            },
            async stderr() {
              return output.stderr ?? "";
            },
            async wait() {
              return { exitCode: 0 };
            },
            async *logs() {
              yield* [];
            },
            async kill() {
              return;
            },
          };
        },
        async readFileToBuffer() {
          return null;
        },
        async stop() {
          return;
        },
        async updateNetworkPolicy() {
          return;
        },
        async writeFiles(files: unknown) {
          calls.writeFiles.push(files);
        },
      };
    },
    async get(id: string) {
      calls.get.push(id);
      return await this.create({ name: id });
    },
    async destroy(id: string) {
      calls.destroy.push(id);
    },
  };
}

function createService(fakeRuntime: ReturnType<typeof runtime>) {
  return createDeveloperSandboxRunService({
    db: {} as Database,
    now: () => new Date("2026-06-03T00:01:00.000Z"),
    runtime: fakeRuntime,
  });
}

describe("developer sandbox run service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDeveloperSandboxCommandMock.mockResolvedValue(commandRow());
    finishDeveloperSandboxCommandMock.mockImplementation(async (_db, input) =>
      commandRow({
        exitCode: input.exitCode,
        finishedAt: input.finishedAt,
        policyDecision: input.policyDecision ?? "allowed",
        policyReason: input.policyReason ?? null,
        policyRuleId: input.policyRuleId ?? null,
        redactionCount: input.redactionCount ?? 0,
        status: input.status,
        stderrBytes: input.stderrBytes ?? 0,
        stdoutBytes: input.stdoutBytes ?? 0,
      })
    );
    createDeveloperSandboxRunMock.mockImplementation(async (_db, input) =>
      sandboxRun({
        actorUserId: input.actorUserId,
        clerkOrgId: input.clerkOrgId,
        vercelSandboxId: input.vercelSandboxId,
        workflowRunId: input.workflowRunId ?? null,
      })
    );
    getDeveloperSandboxRunByPublicIdMock.mockResolvedValue(sandboxRun());
    issueAllEnabledDeveloperConnectionLeasesMock.mockResolvedValue({
      leases: [
        {
          id: 10,
          publicId: "developer_connection_lease_1",
          provider: "sentry",
        },
      ],
      materialization: [
        {
          provider: "sentry",
          env: { SENTRY_AUTH_TOKEN: "sentry-token" },
          files: [
            {
              path: ".sentryclirc",
              contents: "token=sentry-token",
              mode: "0600",
            },
          ],
        },
      ],
    });
    materializeDeveloperConnectionLeasesForSandboxRunMock.mockResolvedValue({
      leases: [
        {
          id: 10,
          publicId: "developer_connection_lease_1",
          provider: "sentry",
        },
      ],
      materialization: [
        {
          provider: "sentry",
          env: { SENTRY_AUTH_TOKEN: "sentry-token" },
          files: [],
        },
      ],
    });
    listExpiredDeveloperSandboxRunsMock.mockResolvedValue([]);
  });

  it("creates a persisted sandbox run without loading developer connections", async () => {
    const fakeRuntime = runtime();
    const service = createService(fakeRuntime);

    await expect(
      service.createDeveloperSandboxRun(ctx(), {
        workflowRunId: "workflow_run_1",
      })
    ).resolves.toMatchObject({
      publicId: "developer_sandbox_run_1",
      status: "running",
    });

    expect(fakeRuntime.calls.create).toHaveLength(1);
    expect(createDeveloperSandboxRunMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        actorUserId: "user_admin",
        clerkOrgId: "org_acme",
        vercelSandboxId: "vercel_sandbox_1",
        workflowRunId: "workflow_run_1",
      })
    );
    expect(issueAllEnabledDeveloperConnectionLeasesMock).not.toHaveBeenCalled();
  });

  it("throws a domain authz error when creating without an active identity", async () => {
    const fakeRuntime = runtime();
    const service = createService(fakeRuntime);

    await expect(
      service.createDeveloperSandboxRun(unauthenticatedCtx())
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "AUTH_REQUIRED",
        kind: "authz",
      })
    );
  });

  it("throws a domain not-found error when a sandbox run cannot be loaded", async () => {
    getDeveloperSandboxRunByPublicIdMock.mockResolvedValueOnce(undefined);
    const fakeRuntime = runtime();
    const service = createService(fakeRuntime);

    await expect(
      service.stopDeveloperSandboxRun(ctx(), {
        sandboxRunId: "developer_sandbox_run_missing",
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "DEVELOPER_SANDBOX_RUN_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("blocks denied commands before loading credentials", async () => {
    const fakeRuntime = runtime();
    const service = createService(fakeRuntime);

    await expect(
      service.runDeveloperSandboxCommand(ctx(), {
        sandboxRunId: "developer_sandbox_run_1",
        command: { cmd: "pscale", args: ["auth", "login"] },
      })
    ).resolves.toMatchObject({
      exitCode: null,
      policy: {
        allowed: false,
        ruleId: "lightfast_default.pscale.auth_login",
      },
      status: "blocked",
    });

    expect(issueAllEnabledDeveloperConnectionLeasesMock).not.toHaveBeenCalled();
    expect(fakeRuntime.calls.exec).toHaveLength(0);
    expect(finishDeveloperSandboxCommandMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        policyDecision: "denied",
        policyRuleId: "lightfast_default.pscale.auth_login",
        status: "blocked",
      })
    );
  });

  it("loads credentials on the first allowed command, redacts output, and stores only metadata", async () => {
    const fakeRuntime = runtime({ stdout: "sentry-token ok\n" });
    const service = createService(fakeRuntime);

    await expect(
      service.runDeveloperSandboxCommand(ctx(), {
        sandboxRunId: "developer_sandbox_run_1",
        command: { cmd: "node", args: ["--version"] },
      })
    ).resolves.toEqual({
      commandId: "developer_sandbox_command_1",
      exitCode: 0,
      policy: { allowed: true },
      status: "succeeded",
      stderr: "",
      stdout: "[redacted] ok\n",
    });

    expect(issueAllEnabledDeveloperConnectionLeasesMock).toHaveBeenCalled();
    expect(fakeRuntime.calls.writeFiles).toEqual([
      [
        {
          content: "token=sentry-token",
          mode: 0o600,
          path: "/vercel/sandbox/.lightfast/provider-auth/developer_connection_lease_1/.sentryclirc",
        },
      ],
    ]);
    expect(markDeveloperConnectionLeaseMaterializedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ leaseId: 10 })
    );
    expect(markDeveloperSandboxRunCredentialsLoadedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ runId: 100 })
    );
    expect(fakeRuntime.calls.exec).toEqual([
      expect.objectContaining({
        cmd: "node",
        env: { SENTRY_AUTH_TOKEN: "sentry-token" },
      }),
    ]);
    expect(finishDeveloperSandboxCommandMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        exitCode: 0,
        redactionCount: 1,
        status: "succeeded",
        stdoutBytes: "sentry-token ok\n".length,
      })
    );
  });

  it("reuses existing lease materialization on subsequent commands", async () => {
    getDeveloperSandboxRunByPublicIdMock.mockResolvedValue(
      sandboxRun({ credentialsLoadedAt: new Date("2026-06-03T00:00:01.000Z") })
    );
    const fakeRuntime = runtime({ stdout: "ok\n" });
    const service = createService(fakeRuntime);

    await service.runDeveloperSandboxCommand(ctx(), {
      sandboxRunId: "developer_sandbox_run_1",
      command: { cmd: "node", args: ["--version"] },
    });

    expect(issueAllEnabledDeveloperConnectionLeasesMock).not.toHaveBeenCalled();
    expect(
      materializeDeveloperConnectionLeasesForSandboxRunMock
    ).toHaveBeenCalledWith(expect.anything(), {
      sandboxRunId: "developer_sandbox_run_1",
    });
  });

  it("reissues credentials when a loaded run has no active leases left", async () => {
    getDeveloperSandboxRunByPublicIdMock.mockResolvedValue(
      sandboxRun({ credentialsLoadedAt: new Date("2026-06-03T00:00:01.000Z") })
    );
    materializeDeveloperConnectionLeasesForSandboxRunMock.mockResolvedValue({
      leases: [],
      materialization: [],
    });
    const fakeRuntime = runtime({ stdout: "ok\n" });
    const service = createService(fakeRuntime);

    await service.runDeveloperSandboxCommand(ctx(), {
      sandboxRunId: "developer_sandbox_run_1",
      command: { cmd: "node", args: ["--version"] },
    });

    expect(issueAllEnabledDeveloperConnectionLeasesMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        sandboxRunId: "developer_sandbox_run_1",
        workflowRunId: null,
      }
    );
    expect(fakeRuntime.calls.writeFiles).toEqual([
      [
        {
          content: "token=sentry-token",
          mode: 0o600,
          path: "/vercel/sandbox/.lightfast/provider-auth/developer_connection_lease_1/.sentryclirc",
        },
      ],
    ]);
    expect(markDeveloperConnectionLeaseMaterializedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ leaseId: 10 })
    );
    expect(markDeveloperSandboxRunCredentialsLoadedMock).not.toHaveBeenCalled();
    expect(fakeRuntime.calls.exec.at(-1)).toEqual(
      expect.objectContaining({
        env: { SENTRY_AUTH_TOKEN: "sentry-token" },
      })
    );
  });

  it("stops a sandbox run and revokes its leases", async () => {
    const fakeRuntime = runtime();
    const service = createService(fakeRuntime);

    await expect(
      service.stopDeveloperSandboxRun(ctx(), {
        sandboxRunId: "developer_sandbox_run_1",
      })
    ).resolves.toEqual({ stopped: true });

    expect(
      revokeDeveloperConnectionLeasesForSandboxRunMock
    ).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkOrgId: "org_acme",
        sandboxRunId: "developer_sandbox_run_1",
      })
    );
    expect(fakeRuntime.calls.destroy).toEqual(["vercel_sandbox_1"]);
    expect(markDeveloperSandboxRunStoppedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ runId: 100 })
    );
  });

  it("cleans up expired runs", async () => {
    listExpiredDeveloperSandboxRunsMock.mockResolvedValue([
      sandboxRun({ publicId: "developer_sandbox_run_expired" }),
    ]);
    const fakeRuntime = runtime();
    const service = createService(fakeRuntime);

    await expect(
      service.cleanupExpiredDeveloperSandboxRuns({ limit: 10 })
    ).resolves.toEqual({ cleaned: 1, failed: 0 });

    expect(
      revokeDeveloperConnectionLeasesForSandboxRunMock
    ).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sandboxRunId: "developer_sandbox_run_expired",
      })
    );
    expect(fakeRuntime.calls.destroy).toEqual(["vercel_sandbox_1"]);
    expect(markDeveloperSandboxRunExpiredMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ runId: 100 })
    );
  });
});
