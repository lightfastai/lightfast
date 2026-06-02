# Automations Schedule-Model Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the automations schedule model from `hourly | daily` to `manual | hourly | daily | weekdays | weekly`, and make `nextRunAt` nullable so manual automations carry no next run.

**Architecture:** Three coupled layers change. (1) `@repo/app-validation` widens the Zod discriminated union and the display formatter. (2) `@db/app` schema widens the column `$type`s and drops `nextRunAt`'s `NOT NULL`; `calculateNextRunAt` returns `Date | null` and gains `manual`/`weekdays`/`weekly` branches; the write/claim/list helpers tolerate null. (3) The tRPC router and Inngest scheduler need **no** code change — they pass the union through and the `lte(nextRunAt, now)` claim filter already excludes NULL. This plan is backend-only and fully testable offline; it does NOT touch the UI, which keeps offering only hourly/daily until the follow-up UI plan.

**Tech Stack:** TypeScript, Zod, Drizzle ORM (PlanetScale MySQL), Vitest. No new dependencies.

**Scope boundary:** This is one of two plans. The visual-language seed + the automations UI surfaces (create form, list, detail editors) are covered by `2026-06-01-automations-visual-language-ui.md` and depend on this plan landing first.

**Schedule model reference:**

| Kind | `scheduleConfig` | `nextRunAt` | Display |
|---|---|---|---|
| `manual` | `{}` | `null` | "Manual" |
| `hourly` | `{ intervalHours: 1–24 }` | every N hours | "Hourly" / "Every N hours" |
| `daily` | `{ time: "HH:mm" }` | daily at time | "Daily at 9:00 AM" |
| `weekdays` | `{ time: "HH:mm" }` | next Mon–Fri at time | "Weekdays at 9:00 AM" |
| `weekly` | `{ dayOfWeek: 0–6, time: "HH:mm" }` | next that-weekday at time | "Weekly on Monday at 9:00 AM" |

`dayOfWeek` uses the JS `Date.getDay()` convention: `0 = Sunday … 6 = Saturday`.

---

## Task 1: Widen the validation discriminated union

**Files:**
- Modify: `packages/app-validation/src/schemas/automations.ts:41-58`
- Test: `packages/app-validation/src/__tests__/automations.test.ts:45-108`

- [ ] **Step 1: Write the failing tests**

Add these `it(...)` blocks inside the existing `describe("normalizeAutomationSchedule", ...)` block in `packages/app-validation/src/__tests__/automations.test.ts` (after the existing case at line 68, before the "rejects hourly intervals" case):

```ts
  it("normalizes manual schedules with an empty config", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "manual",
        config: {},
      })
    ).toEqual({
      kind: "manual",
      config: {},
    });
  });

  it("rejects manual schedules carrying extra config keys", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "manual",
        config: { time: "09:00" },
      })
    ).toThrow();
  });

  it("normalizes weekdays schedules into a UTC HH:mm time", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "weekdays",
        config: { time: "08:15" },
      })
    ).toEqual({
      kind: "weekdays",
      config: { time: "08:15" },
    });
  });

  it("normalizes weekly schedules with a dayOfWeek and time", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "weekly",
        config: { dayOfWeek: 1, time: "09:00" },
      })
    ).toEqual({
      kind: "weekly",
      config: { dayOfWeek: 1, time: "09:00" },
    });
  });

  it("rejects weekly schedules with a dayOfWeek outside 0..6", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "weekly",
        config: { dayOfWeek: 7, time: "09:00" },
      })
    ).toThrow();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @repo/app-validation test automations`
Expected: FAIL — the new kinds are rejected by the current two-member union (`Invalid discriminator value` / parse throws where we expect success).

- [ ] **Step 3: Widen the union**

Replace lines 41-58 of `packages/app-validation/src/schemas/automations.ts` (the `hourlyScheduleSchema` / `dailyScheduleSchema` / `automationScheduleSchema` block) with:

```ts
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

const manualScheduleSchema = z.object({
  kind: z.literal("manual"),
  config: z.object({}).strict(),
});

const hourlyScheduleSchema = z.object({
  kind: z.literal("hourly"),
  config: z.object({
    intervalHours: z.number().int().min(1).max(24),
  }),
});

const dailyScheduleSchema = z.object({
  kind: z.literal("daily"),
  config: z.object({
    time: timeSchema,
  }),
});

const weekdaysScheduleSchema = z.object({
  kind: z.literal("weekdays"),
  config: z.object({
    time: timeSchema,
  }),
});

const weeklyScheduleSchema = z.object({
  kind: z.literal("weekly"),
  config: z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    time: timeSchema,
  }),
});

export const automationScheduleSchema = z.discriminatedUnion("kind", [
  manualScheduleSchema,
  hourlyScheduleSchema,
  dailyScheduleSchema,
  weekdaysScheduleSchema,
  weeklyScheduleSchema,
]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/app-validation test automations`
Expected: PASS — all five new cases plus the existing hourly/daily/mismatch cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-validation/src/schemas/automations.ts packages/app-validation/src/__tests__/automations.test.ts
git commit -m "feat(app-validation): add manual/weekdays/weekly automation schedule kinds"
```

---

## Task 2: Extend the schedule formatter

**Files:**
- Modify: `packages/app-validation/src/schemas/automations.ts:128-158`
- Test: `packages/app-validation/src/__tests__/automations.test.ts:155-205`

- [ ] **Step 1: Write the failing tests**

Add these `it(...)` blocks inside the existing `describe("formatAutomationSchedule", ...)` block (after the daily case at line 204):

```ts
  it("labels manual schedules as 'Manual'", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "manual",
        scheduleConfig: {},
      })
    ).toBe("Manual");
  });

  it("formats weekdays schedules with the 12h clock time", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "weekdays",
        scheduleConfig: { time: "08:15" },
      })
    ).toBe("Weekdays at 8:15 AM");
  });

  it("formats weekly schedules with the weekday name and time", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "weekly",
        scheduleConfig: { dayOfWeek: 1, time: "09:00" },
      })
    ).toBe("Weekly on Monday at 9:00 AM");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @repo/app-validation test automations`
Expected: FAIL — `formatAutomationSchedule` falls through to the daily branch and TypeScript also rejects `scheduleKind: "manual"` against the current `"hourly" | "daily"` summary type.

- [ ] **Step 3: Widen the summary type, add the weekday helper, and extend the formatter**

In `packages/app-validation/src/schemas/automations.ts`, add the weekday label table and helper immediately above `formatClockTime` (currently line 119):

```ts
const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function formatWeekday(dayOfWeek: number): string {
  return WEEKDAY_LABELS[dayOfWeek] ?? "Sunday";
}
```

Replace the `AutomationScheduleSummary` interface (lines 128-132) with:

```ts
export interface AutomationScheduleSummary {
  scheduleConfig:
    | Record<string, never>
    | { intervalHours: number }
    | { time: string }
    | { dayOfWeek: number; time: string };
  scheduleKind: "manual" | "hourly" | "daily" | "weekdays" | "weekly";
  status: "active" | "paused" | "deleted";
}
```

Replace the body of `formatAutomationSchedule` (lines 134-158) with:

```ts
export function formatAutomationSchedule(
  automation: AutomationScheduleSummary
): string {
  if (automation.status === "deleted") {
    return "Deleted";
  }

  if (automation.status === "paused") {
    return "Paused";
  }

  const config = automation.scheduleConfig;

  switch (automation.scheduleKind) {
    case "manual":
      return "Manual";
    case "hourly": {
      const interval =
        "intervalHours" in config ? config.intervalHours : 1;
      return interval === 1 ? "Hourly" : `Every ${interval} hours`;
    }
    case "daily": {
      const time = "time" in config ? config.time : "09:00";
      return `Daily at ${formatClockTime(time)}`;
    }
    case "weekdays": {
      const time = "time" in config ? config.time : "09:00";
      return `Weekdays at ${formatClockTime(time)}`;
    }
    case "weekly": {
      const time = "time" in config ? config.time : "09:00";
      const dayOfWeek = "dayOfWeek" in config ? config.dayOfWeek : 1;
      return `Weekly on ${formatWeekday(dayOfWeek)} at ${formatClockTime(time)}`;
    }
    default:
      return "Manual";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/app-validation test automations`
Expected: PASS — all formatter cases including the three new ones.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @repo/app-validation typecheck`
Expected: PASS — no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/app-validation/src/schemas/automations.ts packages/app-validation/src/__tests__/automations.test.ts
git commit -m "feat(app-validation): format manual/weekdays/weekly schedules"
```

---

## Task 3: Widen the DB column `$type`s

**Files:**
- Modify: `db/app/src/schema/tables/automations.ts:30-34`

- [ ] **Step 1: Widen the type unions**

In `db/app/src/schema/tables/automations.ts`, replace lines 31-34:

```ts
export type AutomationScheduleKind = "hourly" | "daily";
export type AutomationScheduleConfig =
  | { intervalHours: number }
  | { time: string };
```

with:

```ts
export type AutomationScheduleKind =
  | "manual"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly";
export type AutomationScheduleConfig =
  | Record<string, never>
  | { intervalHours: number }
  | { time: string }
  | { dayOfWeek: number; time: string };
```

No column changes here — `scheduleKind` is `varchar(32)` (CODE_LENGTH = 32, fits all kinds) and `scheduleConfig` is `json`. These are `$type` annotations only; they do not produce a migration.

- [ ] **Step 2: Typecheck the package**

Run: `pnpm --filter @db/app typecheck`
Expected: PASS — widening the unions is backward compatible (existing values still assignable).

- [ ] **Step 3: Commit**

```bash
git add db/app/src/schema/tables/automations.ts
git commit -m "feat(db): widen automation schedule kind and config types"
```

---

## Task 4: Make `nextRunAt` nullable and generate the migration

**Files:**
- Modify: `db/app/src/schema/tables/automations.ts:89`
- Create: a generated migration SQL file under the drizzle `out` dir (name auto-assigned — do NOT hand-write it)

- [ ] **Step 1: Drop `.notNull()` from the column**

In `db/app/src/schema/tables/automations.ts`, replace line 89:

```ts
    nextRunAt: datetime("next_run_at", { mode: "date", fsp: 3 }).notNull(),
```

with:

```ts
    nextRunAt: datetime("next_run_at", { mode: "date", fsp: 3 }),
```

Leave the two indexes that reference `nextRunAt` (`orgStatusNextRunIdx` at lines 108-113, `dueIdx` at lines 114-118) unchanged — MySQL indexes permit NULL key values.

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @db/app db:generate`
Expected: A new migration file is written under the drizzle output directory. Do NOT edit it by hand (per `db/CLAUDE.md`).

- [ ] **Step 3: Verify the generated SQL**

Run: `git status --porcelain db/app` then open the new migration file.
Expected: it contains a single `ALTER TABLE \`lightfast_automations\` MODIFY COLUMN \`next_run_at\` datetime(3);` (i.e. the column loses `NOT NULL`). It must NOT drop/recreate the indexes or touch any other column. If it shows unrelated changes, stop and reconcile the schema — do not commit spurious diffs.

- [ ] **Step 4: Typecheck (insert/update types now accept null)**

Run: `pnpm --filter @db/app typecheck`
Expected: PASS — `nextRunAt` becomes `Date | null` in `$inferSelect` and optional-nullable in `$inferInsert`. (Compile errors in `utils/automations.ts` are expected NOT here yet because the current code always passes a `Date`; the `Date | null` return type is introduced in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add db/app/src/schema/tables/automations.ts db/app/src/migrations
git commit -m "feat(db): make automations.next_run_at nullable for manual schedules"
```

> Note: applying this migration to environments is a deploy concern, not part of local verification. Per `db/CLAUDE.md`, CI runs `pnpm db:migrate` against the persistent `staging` branch and opens a `staging → main` deploy request; never run `db:migrate` against `main`. For a local PlanetScale branch smoke test, load the `lightfast-local-infra` skill and follow its `db up` runbook (memory: `pnpm db:push` is unreliable on worktree branches — apply the generated SQL directly if push fails). The unit tests below do not require a live DB.

---

## Task 5: `calculateNextRunAt` returns `Date | null` with manual/weekdays/weekly branches

**Files:**
- Modify: `db/app/src/utils/automations.ts:102-139` (and add a `getLocalWeekday` helper near line 100)
- Test: `db/app/src/__tests__/automations.test.ts:11-74`

- [ ] **Step 1: Write the failing tests**

In `db/app/src/__tests__/automations.test.ts`, first update the FIVE existing assertions in `describe("calculateNextRunAt", ...)` so they compile against the new `Date | null` return type. Change every `expect(next.toISOString())` to `expect(next?.toISOString())` (lines 22, 34, 46, 59, 72).

Then add these cases at the end of the `describe("calculateNextRunAt", ...)` block (after line 73):

```ts
  it("returns null for manual schedules", () => {
    expect(
      calculateNextRunAt({
        after: new Date("2026-05-27T10:15:00.000Z"),
        schedule: { kind: "manual", config: {} },
      })
    ).toBeNull();
  });

  it("skips weekend days for weekdays schedules", () => {
    // 2026-05-30 is a Saturday (UTC); next weekday run is Monday 2026-06-01.
    const next = calculateNextRunAt({
      after: new Date("2026-05-30T10:00:00.000Z"),
      schedule: { kind: "weekdays", config: { time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("returns today for a weekdays schedule when the weekday time is still ahead", () => {
    // 2026-05-27 is a Wednesday (UTC); 09:00 is still ahead of 08:15.
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: { kind: "weekdays", config: { time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-05-27T09:00:00.000Z");
  });

  it("returns the next matching weekday for weekly schedules", () => {
    // 2026-05-27 is a Wednesday (UTC, getUTCDay() === 3); next Monday (1) is 2026-06-01.
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: { kind: "weekly", config: { dayOfWeek: 1, time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("returns today for a weekly schedule when today matches and the time is ahead", () => {
    // 2026-05-27 is a Wednesday (getUTCDay() === 3); time 09:00 is ahead of 08:15.
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: { kind: "weekly", config: { dayOfWeek: 3, time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-05-27T09:00:00.000Z");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @db/app test automations`
Expected: FAIL — `manual`/`weekdays`/`weekly` are not handled (manual falls into the time-split path and throws / weekday cases return the wrong date), and the new return type is required for `toBeNull()`.

- [ ] **Step 3: Add the weekday helper**

In `db/app/src/utils/automations.ts`, add this helper immediately after `addLocalDays` (after line 100):

```ts
function getLocalWeekday(parts: LocalDate): number {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day)
  ).getUTCDay();
}
```

- [ ] **Step 4: Rewrite `calculateNextRunAt`**

Replace the entire `calculateNextRunAt` function (lines 102-139) with:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @db/app test automations`
Expected: PASS — the five existing hourly/daily cases plus all five new cases.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/automations.ts db/app/src/__tests__/automations.test.ts
git commit -m "feat(db): calculateNextRunAt handles manual/weekdays/weekly and null"
```

---

## Task 6: Tolerate null `nextRunAt` in writes, claim, and list ordering

**Files:**
- Modify: `db/app/src/utils/automations.ts:206-220` (list ordering), `:400-462` (claim guard)

`createAutomation` (line 170) and `updateAutomation` (line 259) need NO change: they assign `calculateNextRunAt(...)`'s `Date | null` result straight into a now-nullable column, which the widened insert/update types accept. The two changes below make the claim loop type-safe and keep manual (null) automations from floating to the top of the list.

- [ ] **Step 1: Push null `nextRunAt` rows to the end of the list**

In `listAutomations`, replace the `.orderBy(...)` call (line 219):

```ts
    .orderBy(asc(automations.nextRunAt), asc(automations.id));
```

with:

```ts
    .orderBy(
      sql`${automations.nextRunAt} is null`,
      asc(automations.nextRunAt),
      asc(automations.id)
    );
```

(`sql` is already imported at line 7.) This sorts non-null next-run rows first (the boolean `is null` yields 0 before 1), then by soonest run, with manual automations last.

- [ ] **Step 2: Guard the claim loop against null**

In `claimDueAutomationRuns`, add a defensive guard as the first statement inside the `for (const automation of due)` loop (immediately after line 415 `for (const automation of due) {`), before `const dueAt = automation.nextRunAt;`:

```ts
    if (automation.nextRunAt === null) {
      continue;
    }
```

The `where(... lte(automations.nextRunAt, now))` filter at line 409 already excludes NULL rows, so this branch is never taken at runtime — it narrows `automation.nextRunAt` from `Date | null` to `Date` for the rest of the loop body (`dueAt`, the idempotency key's `.toISOString()`, and the optimistic `eq(automations.nextRunAt, automation.nextRunAt)` guard all now typecheck).

- [ ] **Step 3: Typecheck the package**

Run: `pnpm --filter @db/app typecheck`
Expected: PASS — no `'next​RunAt' is possibly 'null'` errors remain.

- [ ] **Step 4: Run the full db test suite**

Run: `pnpm --filter @db/app test`
Expected: PASS — `automations.test.ts` plus any other suites.

- [ ] **Step 5: Commit**

```bash
git add db/app/src/utils/automations.ts
git commit -m "feat(db): tolerate null next_run_at in claim and list ordering"
```

---

## Task 7: Verify the router and scheduler need no change

**Files:**
- Inspect only: `api/app/src/router/(pending-not-allowed)/automations.ts`, `api/app/src/inngest/workflow/automation-scheduler.ts`
- Run: existing `api/app` test suites

The `create`/`update` procedures pass `input.schedule` (the widened union) straight into the DB helpers; `runNow` is schedule-independent; the scheduler's `claimDueAutomationRuns` filter already excludes manual (null) rows. No source edits expected — this task proves it.

- [ ] **Step 1: Typecheck the api package**

Run: `pnpm --filter @api/app typecheck`
Expected: PASS — the widened union and nullable `nextRunAt` flow through without error.

- [ ] **Step 2: Run the api test suites**

Run: `pnpm --filter @api/app test`
Expected: PASS — `automations-router.test.ts` and `automation-workflow.test.ts` stay green (their fixtures use `kind: "daily"`/`"hourly"` and a non-null `nextRunAt: Date`, all still valid).

- [ ] **Step 3: Confirm the app still typechecks against the widened types**

Run: `pnpm --filter @lightfast/app typecheck`
Expected: PASS — `formatAutomationSchedule(automation)` in `automations-client.tsx` accepts the widened summary; the create form's local `z.enum(["hourly", "daily"])` and the schedule editor's `as "hourly" | "daily"` downcast still compile (the UI keeps offering only the two kinds until the UI plan).

- [ ] **Step 4: No commit** — verification only. If any of the above fails, the failure points to a missed null/kind path; fix it in the owning package and amend the relevant task's commit.

---

## Self-Review

**Spec coverage** (against `2026-06-01-automations-visual-language-design.md` §2 "Schedule-model backend expansion"):
- Validation: `manual`/`weekdays`/`weekly` branches → Task 1. `formatAutomationSchedule` extension + day-of-week helper → Task 2. ✅
- DB types widened → Task 3. `nextRunAt` nullable + generated migration → Task 4. ✅
- `calculateNextRunAt` returns `Date | null`, manual→null, weekdays/weekly branches reusing tz helpers → Task 5. `createAutomation`/`updateAutomation` accept null → Task 6 (no change needed; verified). ✅
- Scheduler `lte(nextRunAt, now)` excludes null; no other path assumes non-null → Task 6 guard + Task 7 verification. ✅
- Tests extended for each kind + null across validation and db suites → Tasks 1, 2, 5. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `AutomationScheduleKind` and `AutomationScheduleConfig` are defined identically in the validation summary (Task 2) and the DB schema (Task 3). `calculateNextRunAt` returns `Date | null` (Task 5) and every consumer (Task 6 create/update/claim, Task 7 router) is reconciled to that signature. `dayOfWeek` is `0–6` (JS `getDay`) everywhere — validation bound (Task 1), `formatWeekday`/`getLocalWeekday` (Tasks 2/5), and test fixtures. ✅
