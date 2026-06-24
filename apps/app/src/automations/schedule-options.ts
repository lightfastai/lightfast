export const SCHEDULE_KINDS = [
  { value: "manual", label: "Manual" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
] as const;

export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]["value"];

export function getScheduleKindLabel(kind: ScheduleKind): string {
  return SCHEDULE_KINDS.find((option) => option.value === kind)?.label ?? kind;
}

export const TIME_BASED_KINDS: ScheduleKind[] = ["daily", "weekdays", "weekly"];

export function isTimeBasedKind(kind: ScheduleKind): boolean {
  return TIME_BASED_KINDS.includes(kind);
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export function getWeekdayLabel(dayOfWeek: number): string {
  return (
    WEEKDAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ??
    "Monday"
  );
}

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
] as const;
