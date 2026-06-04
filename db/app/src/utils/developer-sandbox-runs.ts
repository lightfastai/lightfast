import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { Database } from "../client";
import type {
  DeveloperSandboxCommand,
  DeveloperSandboxCommandPolicyDecision,
  DeveloperSandboxCommandStatus,
  DeveloperSandboxRun,
  DeveloperSandboxRunStatus,
} from "../schema";
import {
  orgDeveloperSandboxCommands,
  orgDeveloperSandboxRuns,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

const DEFAULT_RUN_TTL_MS = 10 * 60 * 1000;
const MAX_RUN_TTL_MS = 30 * 60 * 1000;

export function developerSandboxRunExpiresAt(
  now: Date,
  requestedTtlMs = DEFAULT_RUN_TTL_MS
) {
  const ttlMs = Math.min(requestedTtlMs, MAX_RUN_TTL_MS);
  return new Date(now.getTime() + ttlMs);
}

export async function createDeveloperSandboxRun(
  db: Database,
  input: {
    clerkOrgId: string;
    actorUserId: string;
    workflowRunId?: string | null;
    vercelSandboxId: string;
    status?: DeveloperSandboxRunStatus;
    createdAt?: Date;
    expiresAt?: Date;
    requestedTtlMs?: number;
  }
): Promise<DeveloperSandboxRun> {
  const now = input.createdAt ?? new Date();
  const [inserted] = await db
    .insert(orgDeveloperSandboxRuns)
    .values({
      clerkOrgId: input.clerkOrgId,
      actorUserId: input.actorUserId,
      workflowRunId: input.workflowRunId ?? null,
      vercelSandboxId: input.vercelSandboxId,
      status: input.status ?? "running",
      expiresAt:
        input.expiresAt ??
        developerSandboxRunExpiresAt(now, input.requestedTtlMs),
      createdAt: now,
      updatedAt: now,
    })
    .$returningId();

  if (!inserted?.id) {
    throw new Error("Failed to insert developer sandbox run");
  }

  const row = await getDeveloperSandboxRunById(db, inserted.id);
  if (!row) {
    throw new Error("Failed to load inserted developer sandbox run");
  }
  return row;
}

export async function getDeveloperSandboxRunById(
  db: Database,
  id: number
): Promise<DeveloperSandboxRun | undefined> {
  const [row] = await db
    .select()
    .from(orgDeveloperSandboxRuns)
    .where(eq(orgDeveloperSandboxRuns.id, id))
    .limit(1);
  return row;
}

export async function getDeveloperSandboxRunByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<DeveloperSandboxRun | undefined> {
  const [row] = await db
    .select()
    .from(orgDeveloperSandboxRuns)
    .where(
      and(
        eq(orgDeveloperSandboxRuns.clerkOrgId, input.clerkOrgId),
        eq(orgDeveloperSandboxRuns.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export async function markDeveloperSandboxRunCredentialsLoaded(
  db: Database,
  input: { runId: number; loadedAt: Date }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(orgDeveloperSandboxRuns)
    .set({
      credentialsLoadedAt: input.loadedAt,
      updatedAt: input.loadedAt,
    })
    .where(eq(orgDeveloperSandboxRuns.id, input.runId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.runId);
}

export async function markDeveloperSandboxRunStopped(
  db: Database,
  input: { runId: number; stoppedAt: Date }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(orgDeveloperSandboxRuns)
    .set({
      status: "stopped",
      stoppedAt: input.stoppedAt,
      updatedAt: input.stoppedAt,
    })
    .where(eq(orgDeveloperSandboxRuns.id, input.runId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.runId);
}

export async function markDeveloperSandboxRunExpired(
  db: Database,
  input: { runId: number; expiredAt: Date }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(orgDeveloperSandboxRuns)
    .set({
      status: "expired",
      cleanupAttemptedAt: input.expiredAt,
      updatedAt: input.expiredAt,
    })
    .where(eq(orgDeveloperSandboxRuns.id, input.runId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.runId);
}

export async function markDeveloperSandboxRunCleanupFailed(
  db: Database,
  input: { runId: number; attemptedAt: Date; failureCode: string }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(orgDeveloperSandboxRuns)
    .set({
      cleanupAttemptedAt: input.attemptedAt,
      cleanupFailureCode: input.failureCode,
      updatedAt: input.attemptedAt,
    })
    .where(eq(orgDeveloperSandboxRuns.id, input.runId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.runId);
}

export async function listExpiredDeveloperSandboxRuns(
  db: Database,
  input: { now: Date; limit?: number }
): Promise<DeveloperSandboxRun[]> {
  return await db
    .select()
    .from(orgDeveloperSandboxRuns)
    .where(
      and(
        lte(orgDeveloperSandboxRuns.expiresAt, input.now),
        inArray(orgDeveloperSandboxRuns.status, [
          "starting",
          "running",
          "stopping",
        ])
      )
    )
    .orderBy(asc(orgDeveloperSandboxRuns.expiresAt))
    .limit(input.limit ?? 25);
}

export async function createDeveloperSandboxCommand(
  db: Database,
  input: {
    sandboxRunId: number;
    clerkOrgId: string;
    actorUserId: string;
    cmd: string;
    args: string[];
    cwd?: string | null;
    status?: DeveloperSandboxCommandStatus;
    policyDecision?: DeveloperSandboxCommandPolicyDecision;
    policyRuleId?: string | null;
    policyReason?: string | null;
    startedAt?: Date | null;
    createdAt?: Date;
  }
): Promise<DeveloperSandboxCommand> {
  const now = input.createdAt ?? new Date();
  const [inserted] = await db
    .insert(orgDeveloperSandboxCommands)
    .values({
      sandboxRunId: input.sandboxRunId,
      clerkOrgId: input.clerkOrgId,
      actorUserId: input.actorUserId,
      cmd: input.cmd,
      args: input.args,
      cwd: input.cwd ?? null,
      status: input.status ?? "pending",
      policyDecision: input.policyDecision ?? "allowed",
      policyRuleId: input.policyRuleId ?? null,
      policyReason: input.policyReason ?? null,
      startedAt: input.startedAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .$returningId();

  if (!inserted?.id) {
    throw new Error("Failed to insert developer sandbox command");
  }

  const row = await getDeveloperSandboxCommandById(db, inserted.id);
  if (!row) {
    throw new Error("Failed to load inserted developer sandbox command");
  }
  return row;
}

export async function getDeveloperSandboxCommandById(
  db: Database,
  id: number
): Promise<DeveloperSandboxCommand | undefined> {
  const [row] = await db
    .select()
    .from(orgDeveloperSandboxCommands)
    .where(eq(orgDeveloperSandboxCommands.id, id))
    .limit(1);
  return row;
}

export async function markDeveloperSandboxCommandRunning(
  db: Database,
  input: { commandId: number; startedAt: Date }
): Promise<DeveloperSandboxCommand | undefined> {
  const result = await db
    .update(orgDeveloperSandboxCommands)
    .set({
      status: "running",
      startedAt: input.startedAt,
      updatedAt: input.startedAt,
    })
    .where(eq(orgDeveloperSandboxCommands.id, input.commandId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxCommandById(db, input.commandId);
}

export async function finishDeveloperSandboxCommand(
  db: Database,
  input: {
    commandId: number;
    status: DeveloperSandboxCommandStatus;
    finishedAt: Date;
    exitCode?: number | null;
    stdoutBytes?: number;
    stderrBytes?: number;
    redactionCount?: number;
    policyDecision?: DeveloperSandboxCommandPolicyDecision;
    policyRuleId?: string | null;
    policyReason?: string | null;
  }
): Promise<DeveloperSandboxCommand | undefined> {
  const result = await db
    .update(orgDeveloperSandboxCommands)
    .set({
      status: input.status,
      policyDecision: input.policyDecision,
      policyRuleId: input.policyRuleId,
      policyReason: input.policyReason,
      exitCode: input.exitCode ?? null,
      stdoutBytes: input.stdoutBytes ?? 0,
      stderrBytes: input.stderrBytes ?? 0,
      redactionCount: input.redactionCount ?? 0,
      finishedAt: input.finishedAt,
      updatedAt: input.finishedAt,
    })
    .where(eq(orgDeveloperSandboxCommands.id, input.commandId));

  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxCommandById(db, input.commandId);
}
