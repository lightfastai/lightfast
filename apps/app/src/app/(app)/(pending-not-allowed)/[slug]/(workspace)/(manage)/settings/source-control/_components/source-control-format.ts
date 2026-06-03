const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function displayValue(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Not available";
}

export function formatStatusSubtitle(verb: string, value: Date): string | null {
  if (!isValidDate(value)) {
    return null;
  }
  return `${verb} ${shortDateFormatter.format(value)}`;
}
