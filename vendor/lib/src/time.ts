import { formatDistanceToNow } from "date-fns";

export type RelativeTimeToNowOptions = NonNullable<
  Parameters<typeof formatDistanceToNow>[1]
>;

export function formatUtcCalendarDate(
  value?: Date | number | null,
  locales?: Intl.LocalesArgument
) {
  if (value == null) {
    return null;
  }
  return new Date(value).toLocaleDateString(locales, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
}

export function formatRelativeTimeToNow(
  value: Date | number,
  options?: RelativeTimeToNowOptions
) {
  return formatDistanceToNow(value, options);
}

/**
 * Formats a duration in milliseconds into a compact, human-readable label
 * (e.g. `820ms`, `3.2s`, `2m 5s`, `1h 12m`). Returns `—` for negative or
 * non-finite inputs so callers can pass a raw `finishedAt - startedAt` without
 * guarding first.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (totalMinutes < 60) {
    return remainingSeconds
      ? `${totalMinutes}m ${remainingSeconds}s`
      : `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
