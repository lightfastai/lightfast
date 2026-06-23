import { randomUUID } from "node:crypto";
import type { Database, DeveloperSandboxRun } from "@db/app";
import {
  createDeveloperSandboxCommand,
  createDeveloperSandboxRun,
  finishDeveloperSandboxCommand,
  getDeveloperSandboxRunByPublicId,
  listExpiredDeveloperSandboxRuns,
  markDeveloperConnectionLeaseMaterialized,
  markDeveloperSandboxRunCleanupFailed,
  markDeveloperSandboxRunCredentialsLoaded,
  markDeveloperSandboxRunExpired,
  markDeveloperSandboxRunStopped,
  revokeDeveloperConnectionLeasesForSandboxRun,
} from "@db/app";
import {
  createVercelSandboxRuntime,
  type SandboxRuntime,
} from "@repo/sandbox-runtime";
import { ConflictError, NotFoundError } from "../../domain/errors";
import {
  issueAllEnabledDeveloperConnectionLeases,
  materializeDeveloperConnectionLeasesForSandboxRun,
} from "../developer-connections";
import { evaluateDeveloperSandboxCommandPolicy } from "./policy";
import { redactText } from "./redaction";

const DEFAULT_SANDBOX_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_COMMAND_TIMEOUT_MS = 2 * 60 * 1000;
const CREDENTIAL_BASE_DIR = "/vercel/sandbox/.lightfast/provider-auth";

interface DeveloperSandboxRunServiceContext {
  actor: {
    userId: string;
  };
  organization: {
    orgId: string;
  };
}

interface DeveloperSandboxRunServiceOptions {
  db: Database;
  now?: () => Date;
  runtime?: SandboxRuntime;
}

interface DeveloperSandboxCommandInput {
  args?: string[];
  cmd: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

interface MaterializedCredentials {
  env: Record<string, string>;
  secrets: string[];
}

function ensureRunnableRun(run: DeveloperSandboxRun, now: Date) {
  if (run.status !== "running" && run.status !== "starting") {
    throw new ConflictError(
      "DEVELOPER_SANDBOX_RUN_NOT_RUNNABLE",
      `Developer sandbox run is ${run.status}`
    );
  }
  if (run.expiresAt <= now) {
    throw new ConflictError(
      "DEVELOPER_SANDBOX_RUN_EXPIRED",
      "Developer sandbox run has expired"
    );
  }
}

function credentialFilePath(leasePublicId: string, path: string) {
  const relativePath = path.replace(/^\/+/, "");
  return `${CREDENTIAL_BASE_DIR}/${leasePublicId}/${relativePath}`;
}

function materializedEnv(
  materialization: Array<{ env: Record<string, string> }>
) {
  return Object.assign(
    {},
    ...materialization.map((entry) => entry.env)
  ) as Record<string, string>;
}

function materializedSecrets(
  materialization: Array<{
    env: Record<string, string>;
    files: Array<{ contents: string }>;
  }>
) {
  return materialization.flatMap((entry) => [
    ...Object.values(entry.env),
    ...entry.files.map((file) => file.contents),
  ]);
}

function bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

function cleanupFailureCode(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name.slice(0, 32);
  }
  return "cleanup_failed";
}

export function createDeveloperSandboxRunService(
  options: DeveloperSandboxRunServiceOptions
) {
  const runtime = options.runtime ?? createVercelSandboxRuntime();
  const now = options.now ?? (() => new Date());

  function developerConnectionLeaseContext(
    ctx: DeveloperSandboxRunServiceContext
  ) {
    return {
      actor: { userId: ctx.actor.userId },
      db: options.db,
      organization: { orgId: ctx.organization.orgId },
    };
  }

  async function loadRun(
    ctx: DeveloperSandboxRunServiceContext,
    sandboxRunId: string
  ) {
    const run = await getDeveloperSandboxRunByPublicId(options.db, {
      clerkOrgId: ctx.organization.orgId,
      publicId: sandboxRunId,
    });
    if (!run) {
      throw new NotFoundError(
        "DEVELOPER_SANDBOX_RUN_NOT_FOUND",
        "Developer sandbox run was not found."
      );
    }
    return { run };
  }

  async function materializeCredentials(
    ctx: DeveloperSandboxRunServiceContext,
    run: DeveloperSandboxRun
  ): Promise<MaterializedCredentials> {
    const leaseContext = developerConnectionLeaseContext(ctx);

    async function issueAndWriteCredentials() {
      const issued = await issueAllEnabledDeveloperConnectionLeases(
        leaseContext,
        {
          sandboxRunId: run.publicId,
          workflowRunId: run.workflowRunId,
        }
      );
      const sandbox = await runtime.get(run.vercelSandboxId);
      const files = issued.materialization.flatMap((entry, index) => {
        const lease = issued.leases[index];
        if (!lease) {
          return [];
        }
        return entry.files.map((file) => ({
          content: file.contents,
          mode: file.mode === "0600" ? 0o600 : undefined,
          path: credentialFilePath(lease.publicId, file.path),
        }));
      });

      if (files.length > 0) {
        await sandbox.writeFiles(files);
      }

      const loadedAt = now();
      await Promise.all(
        issued.leases.map((lease) =>
          markDeveloperConnectionLeaseMaterialized(options.db, {
            leaseId: lease.id,
            materializedAt: loadedAt,
          })
        )
      );

      return {
        env: materializedEnv(issued.materialization),
        secrets: materializedSecrets(issued.materialization),
      };
    }

    if (run.credentialsLoadedAt) {
      const existing = await materializeDeveloperConnectionLeasesForSandboxRun(
        leaseContext,
        { sandboxRunId: run.publicId }
      );
      if (existing.leases.length === 0) {
        return await issueAndWriteCredentials();
      }
      return {
        env: materializedEnv(existing.materialization),
        secrets: materializedSecrets(existing.materialization),
      };
    }

    const credentials = await issueAndWriteCredentials();
    await markDeveloperSandboxRunCredentialsLoaded(options.db, {
      runId: run.id,
      loadedAt: now(),
    });

    return credentials;
  }

  return {
    async createDeveloperSandboxRun(
      ctx: DeveloperSandboxRunServiceContext,
      input: { requestedTtlMs?: number; workflowRunId?: string | null } = {}
    ) {
      const sandbox = await runtime.create({
        name: `developer-sandbox-${randomUUID()}`,
        runtime: "node24",
        timeoutMs: input.requestedTtlMs ?? DEFAULT_SANDBOX_TIMEOUT_MS,
      });

      try {
        return await createDeveloperSandboxRun(options.db, {
          clerkOrgId: ctx.organization.orgId,
          actorUserId: ctx.actor.userId,
          workflowRunId: input.workflowRunId ?? null,
          vercelSandboxId: sandbox.id,
          requestedTtlMs: input.requestedTtlMs,
        });
      } catch (error) {
        await runtime.destroy(sandbox.id);
        throw error;
      }
    },

    async runDeveloperSandboxCommand(
      ctx: DeveloperSandboxRunServiceContext,
      input: {
        sandboxRunId: string;
        command: DeveloperSandboxCommandInput;
      }
    ) {
      const { run } = await loadRun(ctx, input.sandboxRunId);
      const startedAt = now();
      ensureRunnableRun(run, startedAt);
      const policy = evaluateDeveloperSandboxCommandPolicy(input.command);
      const command = await createDeveloperSandboxCommand(options.db, {
        sandboxRunId: run.id,
        clerkOrgId: ctx.organization.orgId,
        actorUserId: ctx.actor.userId,
        cmd: input.command.cmd,
        args: input.command.args ?? [],
        cwd: input.command.cwd ?? null,
        status: policy.allowed ? "running" : "blocked",
        policyDecision: policy.allowed ? "allowed" : "denied",
        policyRuleId: policy.allowed ? null : policy.ruleId,
        policyReason: policy.allowed ? null : policy.reason,
        startedAt,
      });

      if (!policy.allowed) {
        await finishDeveloperSandboxCommand(options.db, {
          commandId: command.id,
          status: "blocked",
          finishedAt: now(),
          exitCode: null,
          policyDecision: "denied",
          policyRuleId: policy.ruleId,
          policyReason: policy.reason,
        });

        return {
          commandId: command.publicId,
          exitCode: null,
          policy,
          status: "blocked" as const,
          stderr: "",
          stdout: "",
        };
      }

      const credentials = await materializeCredentials(ctx, run);
      const sandbox = await runtime.get(run.vercelSandboxId);
      const runtimeCommand = await sandbox.exec({
        cmd: input.command.cmd,
        args: input.command.args,
        cwd: input.command.cwd,
        env: {
          ...credentials.env,
          ...input.command.env,
        },
        timeoutMs: input.command.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
      });
      const [result, stdout, stderr] = await Promise.all([
        runtimeCommand.wait(),
        runtimeCommand.stdout(),
        runtimeCommand.stderr(),
      ]);
      const redactedStdout = redactText(stdout, credentials.secrets);
      const redactedStderr = redactText(stderr, credentials.secrets);
      const status = result.exitCode === 0 ? "succeeded" : "failed";

      await finishDeveloperSandboxCommand(options.db, {
        commandId: command.id,
        status,
        finishedAt: now(),
        exitCode: result.exitCode,
        stdoutBytes: bytes(stdout),
        stderrBytes: bytes(stderr),
        redactionCount:
          redactedStdout.redactionCount + redactedStderr.redactionCount,
      });

      return {
        commandId: command.publicId,
        exitCode: result.exitCode,
        policy,
        status,
        stderr: redactedStderr.text,
        stdout: redactedStdout.text,
      };
    },

    async stopDeveloperSandboxRun(
      ctx: DeveloperSandboxRunServiceContext,
      input: { sandboxRunId: string }
    ) {
      const { run } = await loadRun(ctx, input.sandboxRunId);
      const stoppedAt = now();
      await revokeDeveloperConnectionLeasesForSandboxRun(options.db, {
        clerkOrgId: ctx.organization.orgId,
        sandboxRunId: run.publicId,
        revokedAt: stoppedAt,
      });
      await runtime.destroy(run.vercelSandboxId);
      await markDeveloperSandboxRunStopped(options.db, {
        runId: run.id,
        stoppedAt,
      });
      return { stopped: true };
    },

    async cleanupExpiredDeveloperSandboxRuns(input: { limit?: number } = {}) {
      const cleanupAt = now();
      const expired = await listExpiredDeveloperSandboxRuns(options.db, {
        now: cleanupAt,
        limit: input.limit,
      });
      let cleaned = 0;
      let failed = 0;

      for (const run of expired) {
        try {
          await revokeDeveloperConnectionLeasesForSandboxRun(options.db, {
            clerkOrgId: run.clerkOrgId,
            sandboxRunId: run.publicId,
            revokedAt: cleanupAt,
          });
          await runtime.destroy(run.vercelSandboxId);
          await markDeveloperSandboxRunExpired(options.db, {
            runId: run.id,
            expiredAt: cleanupAt,
          });
          cleaned += 1;
        } catch (error) {
          failed += 1;
          await markDeveloperSandboxRunCleanupFailed(options.db, {
            runId: run.id,
            attemptedAt: cleanupAt,
            failureCode: cleanupFailureCode(error),
          });
        }
      }

      return { cleaned, failed };
    },
  };
}
