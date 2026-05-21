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
