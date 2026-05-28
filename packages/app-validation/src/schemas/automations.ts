import { z } from "zod";

export const AUTOMATION_NAME_MAX_LENGTH = 120;
export const AUTOMATION_PROMPT_MAX_LENGTH = 4000;
export const AUTOMATION_ID_PREFIX = "automation_";
export const AUTOMATION_RUN_ID_PREFIX = "automation_run_";

const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

function isValidIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidIanaTimeZone, "Invalid IANA timezone");

export const automationIdSchema = z
  .string()
  .regex(
    new RegExp(`^${AUTOMATION_ID_PREFIX}${UUID_PATTERN}$`),
    "Invalid automation id"
  );

export const automationRunIdSchema = z
  .string()
  .regex(
    new RegExp(`^${AUTOMATION_RUN_ID_PREFIX}${UUID_PATTERN}$`),
    "Invalid automation run id"
  );

const hourlyScheduleSchema = z.object({
  kind: z.literal("hourly"),
  config: z.object({
    intervalHours: z.number().int().min(1).max(24),
  }),
});

const dailyScheduleSchema = z.object({
  kind: z.literal("daily"),
  config: z.object({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format"),
  }),
});

export const automationScheduleSchema = z.discriminatedUnion("kind", [
  hourlyScheduleSchema,
  dailyScheduleSchema,
]);

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1).max(AUTOMATION_NAME_MAX_LENGTH),
  prompt: z.string().trim().min(1).max(AUTOMATION_PROMPT_MAX_LENGTH),
  schedule: automationScheduleSchema,
  timezone: timezoneSchema.default("UTC"),
});

export const updateAutomationSchema = z
  .object({
    id: automationIdSchema,
    name: z.string().trim().min(1).max(AUTOMATION_NAME_MAX_LENGTH).optional(),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(AUTOMATION_PROMPT_MAX_LENGTH)
      .optional(),
    schedule: automationScheduleSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine(
    ({ name, prompt, schedule, timezone }) =>
      name !== undefined ||
      prompt !== undefined ||
      schedule !== undefined ||
      timezone !== undefined,
    "At least one field must be updated"
  );

export const getAutomationSchema = z.object({
  id: automationIdSchema,
});

export const listAutomationRunsSchema = z.object({
  id: automationIdSchema,
  limit: z.number().int().min(1).max(100).default(25),
});

export type AutomationScheduleInput = z.infer<typeof automationScheduleSchema>;
export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

/**
 * Normalized schedule shape after parsing. Equivalent to `AutomationScheduleInput`
 * but named to express that the value is post-validation.
 */
export type NormalizedSchedule = AutomationScheduleInput;
export type NormalizedAutomationSchedule = AutomationScheduleInput;

/**
 * Parses an arbitrary schedule input into the discriminated union shape.
 * Throws if the input doesn't match either branch.
 */
export function normalizeAutomationSchedule(
  input: unknown
): NormalizedSchedule {
  return automationScheduleSchema.parse(input);
}

export function formatClockTime(value: string): string {
  const [hourText = "0", minuteText = "0"] = value.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export interface AutomationScheduleSummary {
  scheduleConfig: { intervalHours: number } | { time: string };
  scheduleKind: "hourly" | "daily";
  status: "active" | "paused" | "deleted";
}

export function formatAutomationSchedule(
  automation: AutomationScheduleSummary
): string {
  if (automation.status === "deleted") {
    return "Deleted";
  }

  if (automation.status === "paused") {
    return "Paused";
  }

  if (automation.scheduleKind === "hourly") {
    const interval =
      "intervalHours" in automation.scheduleConfig
        ? automation.scheduleConfig.intervalHours
        : 1;
    return interval === 1 ? "Hourly" : `Every ${interval} hours`;
  }

  const time =
    "time" in automation.scheduleConfig
      ? automation.scheduleConfig.time
      : "09:00";
  return `Daily at ${formatClockTime(time)}`;
}
