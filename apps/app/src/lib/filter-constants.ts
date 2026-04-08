import { PROVIDER_DISPLAY } from "@repo/app-providers/client";

export const SOURCE_TYPE_OPTIONS = Object.entries(PROVIDER_DISPLAY).map(
  ([value, entry]) => ({ value, label: entry.displayName })
);

export const AGE_PRESET_OPTIONS = [
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "24h", label: "24 hours" },
  { value: "72h", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "none", label: "No limit" },
] as const;

export function dateRangeFromPreset(preset: string): {
  after?: string;
} {
  if (preset === "none") {
    return {};
  }
  const hoursMap: Record<string, number> = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
    "72h": 72,
    "7d": 168,
    "30d": 720,
  };
  const hours = hoursMap[preset];
  if (!hours) {
    return {};
  }
  const after = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return { after };
}
