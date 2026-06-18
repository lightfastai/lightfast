import type { ConnectableConnectorProvider } from "@lightfast/connector-core";
import {
  type AutomationScheduleInput,
  type NormalizedAutomationSchedule,
  type NormalizedSchedule,
  normalizeAutomationSchedule,
} from "@repo/app-validation/schemas";
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  type Automation,
  type AutomationRun,
  type AutomationRunTrigger,
  orgAutomationRuns as automationRuns,
  orgAutomations as automations,
  createAutomationId,
  createAutomationRunId,
} from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

export {
  type AutomationScheduleInput,
  type NormalizedAutomationSchedule,
  type NormalizedSchedule,
  normalizeAutomationSchedule,
};

interface LocalDate {
  day: number;
  month: number;
  year: number;
}

interface LocalDateTime extends LocalDate {
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timezone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    day: value("day"),
    hour: value("hour") % 24,
    minute: value("minute"),
    month: value("month"),
    second: value("second"),
    year: value("year"),
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc(
  parts: LocalDate & { hour: number; minute: number },
  timezone: string
): Date {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  );
  const firstOffset = getTimezoneOffsetMs(utcGuess, timezone);
  const firstResult = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimezoneOffsetMs(firstResult, timezone);
  return new Date(utcGuess.getTime() - secondOffset);
}

function addLocalDays(parts: LocalDate, days: number): LocalDate {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days)
  );
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function getLocalWeekday(parts: LocalDate): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function calculateNextRunAt(input: {
  after: Date;
  from?: Date;
  schedule: NormalizedSchedule;
  timezone?: string;
}): Date | null {
  const { schedule } = input;

  if (schedule.kind === "manual") {
    return null;
  }

  if (schedule.kind === "hourly") {
    const intervalMs = schedule.config.intervalHours * 60 * 60 * 1000;
    let next = new Date((input.from ?? input.after).getTime() + intervalMs);
    while (next <= input.after) {
      next = new Date(next.getTime() + intervalMs);
    }
    return next;
  }

  // daily | weekdays | weekly all resolve a local HH:mm time in the timezone,
  // then advance day-by-day until the slot is both in the future and lands on
  // an acceptable weekday.
  const [hours = 0, minutes = 0] = schedule.config.time.split(":").map(Number);
  const timezone = input.timezone ?? "UTC";
  const afterParts = getZonedParts(input.after, timezone);
  let dateParts: LocalDate = {
    day: afterParts.day,
    month: afterParts.month,
    year: afterParts.year,
  };

  const isAcceptableDay = (parts: LocalDate): boolean => {
    if (schedule.kind === "weekdays") {
      const weekday = getLocalWeekday(parts);
      return weekday >= 1 && weekday <= 5;
    }
    if (schedule.kind === "weekly") {
      return getLocalWeekday(parts) === schedule.config.dayOfWeek;
    }
    return true;
  };

  let next = zonedTimeToUtc(
    { ...dateParts, hour: hours, minute: minutes },
    timezone
  );
  while (next <= input.after || !isAcceptableDay(dateParts)) {
    dateParts = addLocalDays(dateParts, 1);
    next = zonedTimeToUtc(
      { ...dateParts, hour: hours, minute: minutes },
      timezone
    );
  }
  return next;
}

export interface CreateAutomationInput {
  clerkOrgId: string;
  connectorProvider?: ConnectableConnectorProvider | null;
  createdByUserId: string;
  name: string;
  prompt: string;
  schedule: AutomationScheduleInput;
  timezone?: string;
}

export async function createAutomation(
  db: Database,
  input: CreateAutomationInput,
  options: { now?: Date } = {}
): Promise<Automation> {
  const now = options.now ?? new Date();
  const schedule = normalizeAutomationSchedule(input.schedule);
  const publicId = createAutomationId();
  const timezone = input.timezone ?? "UTC";

  await db.insert(automations).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    connectorProvider: input.connectorProvider ?? null,
    createdByUserId: input.createdByUserId,
    name: input.name,
    prompt: input.prompt,
    scheduleKind: schedule.kind,
    scheduleConfig: schedule.config,
    timezone,
    status: "active",
    nextRunAt: calculateNextRunAt({ after: now, schedule, timezone }),
  });

  const inserted = await getAutomationByPublicId(db, {
    clerkOrgId: input.clerkOrgId,
    publicId,
  });
  if (!inserted) {
    throw new Error(`Failed to create automation ${publicId}`);
  }
  return inserted;
}

export interface GetAutomationByPublicIdInput {
  clerkOrgId: string;
  publicId: string;
}

export async function getAutomationByPublicId(
  db: Database,
  input: GetAutomationByPublicIdInput
): Promise<Automation | undefined> {
  const [row] = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.clerkOrgId, input.clerkOrgId),
        eq(automations.publicId, input.publicId),
        ne(automations.status, "deleted")
      )
    )
    .limit(1);
  return row;
}

export async function listAutomations(
  db: Database,
  input: { clerkOrgId: string }
): Promise<Automation[]> {
  return db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.clerkOrgId, input.clerkOrgId),
        ne(automations.status, "deleted")
      )
    )
    .orderBy(
      sql`${automations.nextRunAt} is null`,
      asc(automations.nextRunAt),
      asc(automations.id)
    );
}

export interface UpdateAutomationInput {
  clerkOrgId: string;
  name?: string;
  prompt?: string;
  publicId: string;
  schedule?: AutomationScheduleInput;
  timezone?: string;
}

export async function updateAutomation(
  db: Database,
  input: UpdateAutomationInput,
  options: { now?: Date } = {}
): Promise<Automation | undefined> {
  const existing = await getAutomationByPublicId(db, input);
  if (!existing) {
    return;
  }

  const nextValues: Partial<typeof automations.$inferInsert> = {};
  if (input.name !== undefined) {
    nextValues.name = input.name;
  }
  if (input.prompt !== undefined) {
    nextValues.prompt = input.prompt;
  }
  if (input.schedule || input.timezone !== undefined) {
    const schedule = input.schedule
      ? normalizeAutomationSchedule(input.schedule)
      : normalizeAutomationSchedule({
          kind: existing.scheduleKind,
          config: existing.scheduleConfig,
        });
    const timezone = input.timezone ?? existing.timezone;
    nextValues.scheduleKind = schedule.kind;
    nextValues.scheduleConfig = schedule.config;
    nextValues.timezone = timezone;
    nextValues.nextRunAt = calculateNextRunAt({
      after: options.now ?? new Date(),
      schedule,
      timezone,
    });
    nextValues.scheduleVersion =
      sql`${automations.scheduleVersion} + 1` as unknown as number | undefined;
  }

  await db
    .update(automations)
    .set(nextValues)
    .where(
      and(
        eq(automations.clerkOrgId, input.clerkOrgId),
        eq(automations.publicId, input.publicId),
        ne(automations.status, "deleted")
      )
    );

  return getAutomationByPublicId(db, input);
}

export async function setAutomationStatus(
  db: Database,
  input: {
    clerkOrgId: string;
    publicId: string;
    status: "active" | "paused" | "deleted";
  }
): Promise<Automation | undefined> {
  await db
    .update(automations)
    .set({
      status: input.status,
    })
    .where(
      and(
        eq(automations.clerkOrgId, input.clerkOrgId),
        eq(automations.publicId, input.publicId),
        ne(automations.status, "deleted")
      )
    );
  return getAutomationByPublicId(db, input);
}

export async function deleteAutomation(
  db: Database,
  input: {
    clerkOrgId: string;
    publicId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(automations)
    .set({
      status: "deleted",
    })
    .where(
      and(
        eq(automations.clerkOrgId, input.clerkOrgId),
        eq(automations.publicId, input.publicId),
        ne(automations.status, "deleted")
      )
    );
  return getRowsAffected(result) > 0;
}

export async function listAutomationRuns(
  db: Database,
  input: { automationPublicId: string; clerkOrgId: string; limit?: number }
): Promise<AutomationRun[]> {
  return db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.clerkOrgId, input.clerkOrgId),
        eq(automationRuns.automationPublicId, input.automationPublicId)
      )
    )
    .orderBy(desc(automationRuns.createdAt), desc(automationRuns.id))
    .limit(input.limit ?? 25);
}

export async function getAutomationRunByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<AutomationRun | undefined> {
  const [row] = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.clerkOrgId, input.clerkOrgId),
        eq(automationRuns.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export async function createAutomationRun(
  db: Database,
  input: {
    automation: Automation;
    dueAt: Date;
    idempotencyKey?: string;
    trigger: AutomationRunTrigger;
  }
): Promise<AutomationRun> {
  const publicId = createAutomationRunId();
  const idempotencyKey =
    input.idempotencyKey ?? `manual:${input.automation.publicId}:${publicId}`;

  await db
    .insert(automationRuns)
    .values({
      publicId,
      automationId: input.automation.id,
      automationPublicId: input.automation.publicId,
      clerkOrgId: input.automation.clerkOrgId,
      trigger: input.trigger,
      status: "pending",
      dueAt: input.dueAt,
      scheduleVersion: input.automation.scheduleVersion,
      idempotencyKey,
      output: null,
    })
    .$returningId()
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      return [];
    });

  const run = await getAutomationRunByIdempotencyKey(db, {
    idempotencyKey,
  });
  if (!run) {
    throw new Error(`Failed to create automation run for ${idempotencyKey}`);
  }
  return run;
}

export async function getAutomationRunByIdempotencyKey(
  db: Database,
  input: { idempotencyKey: string }
): Promise<AutomationRun | undefined> {
  const [row] = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.idempotencyKey, input.idempotencyKey))
    .limit(1);
  return row;
}

export interface ClaimedAutomationRun {
  automation: Automation;
  run: AutomationRun;
}

export async function claimDueAutomationRuns(
  db: Database,
  input: { limit?: number; now?: Date } = {}
): Promise<ClaimedAutomationRun[]> {
  const now = input.now ?? new Date();
  const due = await db
    .select()
    .from(automations)
    .where(
      and(eq(automations.status, "active"), lte(automations.nextRunAt, now))
    )
    .orderBy(asc(automations.nextRunAt), asc(automations.id))
    .limit(input.limit ?? 25);

  const claimed: ClaimedAutomationRun[] = [];
  for (const automation of due) {
    if (automation.nextRunAt === null) {
      continue;
    }
    const dueAt = automation.nextRunAt;
    const schedule = normalizeAutomationSchedule({
      kind: automation.scheduleKind,
      config: automation.scheduleConfig,
    });
    const nextRunAt = calculateNextRunAt({
      after: now,
      from: dueAt,
      schedule,
      timezone: automation.timezone,
    });
    const idempotencyKey = [
      "scheduled",
      automation.publicId,
      automation.scheduleVersion,
      automation.nextRunAt.toISOString(),
    ].join(":");

    const run = await createAutomationRun(db, {
      automation,
      dueAt,
      idempotencyKey,
      trigger: "scheduled",
    });

    const result = await db
      .update(automations)
      .set({
        lastRunAt: automation.nextRunAt,
        nextRunAt,
      })
      .where(
        and(
          eq(automations.id, automation.id),
          eq(automations.status, "active"),
          eq(automations.scheduleVersion, automation.scheduleVersion),
          eq(automations.nextRunAt, automation.nextRunAt)
        )
      );

    if (getRowsAffected(result) > 0) {
      claimed.push({ automation, run });
    }
  }

  return claimed;
}

export async function markAutomationRunRunning(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<boolean> {
  const result = await db
    .update(automationRuns)
    .set({
      status: "running",
      startedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(automationRuns.clerkOrgId, input.clerkOrgId),
        eq(automationRuns.publicId, input.publicId),
        eq(automationRuns.status, "pending")
      )
    );
  return getRowsAffected(result) > 0;
}

export async function markAutomationRunCompleted(
  db: Database,
  input: {
    clerkOrgId: string;
    output: Record<string, unknown>;
    publicId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(automationRuns)
    .set({
      status: "completed",
      output: input.output,
      finishedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(automationRuns.clerkOrgId, input.clerkOrgId),
        eq(automationRuns.publicId, input.publicId),
        eq(automationRuns.status, "running")
      )
    );
  return getRowsAffected(result) > 0;
}

export async function markAutomationRunFailed(
  db: Database,
  input: {
    clerkOrgId: string;
    errorCode: string;
    errorMessage: string;
    publicId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(automationRuns)
    .set({
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(automationRuns.clerkOrgId, input.clerkOrgId),
        eq(automationRuns.publicId, input.publicId),
        inArray(automationRuns.status, ["pending", "running"])
      )
    );
  return getRowsAffected(result) > 0;
}

export async function markAutomationRunSkipped(
  db: Database,
  input: {
    clerkOrgId: string;
    errorCode: string;
    errorMessage: string;
    publicId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(automationRuns)
    .set({
      status: "skipped",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(automationRuns.clerkOrgId, input.clerkOrgId),
        eq(automationRuns.publicId, input.publicId),
        eq(automationRuns.status, "pending")
      )
    );
  return getRowsAffected(result) > 0;
}
