import { connectableConnectorProviderSchema } from "@repo/api-contract";
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

export const automationTargetKindSchema = z.enum(["connector", "decisions"]);

const connectorAutomationTargetSchema = z.object({
  connectorProvider: connectableConnectorProviderSchema,
  targetKind: z.literal("connector"),
});

const decisionsAutomationTargetSchema = z.object({
  connectorProvider: z.literal(null),
  targetKind: z.literal("decisions"),
});

const automationTargetSchema = z.discriminatedUnion("targetKind", [
  connectorAutomationTargetSchema,
  decisionsAutomationTargetSchema,
]);

export const createAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(AUTOMATION_NAME_MAX_LENGTH),
    prompt: z.string().trim().min(1).max(AUTOMATION_PROMPT_MAX_LENGTH),
    schedule: automationScheduleSchema,
    timezone: timezoneSchema.default("UTC"),
  })
  .and(automationTargetSchema);

export const updateAutomationSchema = z
  .object({
    connectorProvider: connectableConnectorProviderSchema.nullable().optional(),
    id: automationIdSchema,
    name: z.string().trim().min(1).max(AUTOMATION_NAME_MAX_LENGTH).optional(),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(AUTOMATION_PROMPT_MAX_LENGTH)
      .optional(),
    schedule: automationScheduleSchema.optional(),
    targetKind: automationTargetKindSchema.optional(),
    timezone: timezoneSchema.optional(),
  })
  .superRefine((values, ctx) => {
    const targetTouched =
      values.targetKind !== undefined || values.connectorProvider !== undefined;
    if (!targetTouched) {
      return;
    }

    if (values.targetKind === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target kind is required when updating the automation target",
        path: ["targetKind"],
      });
      return;
    }

    if (
      values.targetKind === "connector" &&
      values.connectorProvider === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector provider is required for connector automations",
        path: ["connectorProvider"],
      });
      return;
    }

    if (
      values.targetKind === "connector" &&
      values.connectorProvider === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector provider is required for connector automations",
        path: ["connectorProvider"],
      });
    }

    if (
      values.targetKind === "decisions" &&
      values.connectorProvider !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Connector provider must be null for decisions automations",
        path: ["connectorProvider"],
      });
    }
  })
  .refine(
    ({ connectorProvider, name, prompt, schedule, targetKind, timezone }) =>
      connectorProvider !== undefined ||
      name !== undefined ||
      prompt !== undefined ||
      schedule !== undefined ||
      targetKind !== undefined ||
      timezone !== undefined,
    "At least one field must be updated"
  );

export const getAutomationSchema = z.object({
  id: automationIdSchema,
});

export const getAutomationRunSchema = z.object({
  id: automationRunIdSchema,
});

export const listAutomationRunsSchema = z.object({
  id: automationIdSchema,
  limit: z.number().int().min(1).max(100).default(25),
});

export type AutomationScheduleInput = z.infer<typeof automationScheduleSchema>;
export type AutomationTargetKind = z.infer<typeof automationTargetKindSchema>;
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

export function formatClockTime(value: string): string {
  const [hourText = "0", minuteText = "0"] = value.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export interface AutomationScheduleSummary {
  scheduleConfig:
    | Record<string, never>
    | { intervalHours: number }
    | { time: string }
    | { dayOfWeek: number; time: string };
  scheduleKind: "manual" | "hourly" | "daily" | "weekdays" | "weekly";
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

  const config = automation.scheduleConfig;

  switch (automation.scheduleKind) {
    case "manual":
      return "Manual";
    case "hourly": {
      const interval = "intervalHours" in config ? config.intervalHours : 1;
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
