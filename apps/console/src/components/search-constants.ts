import type { LucideIcon } from "lucide-react";
import { Zap, Scale, Brain } from "lucide-react";

export const SOURCE_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
] as const;

export const OBSERVATION_TYPE_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull_request_opened", label: "PR Opened" },
  { value: "pull_request_merged", label: "PR Merged" },
  { value: "pull_request_closed", label: "PR Closed" },
  { value: "issue_opened", label: "Issue Opened" },
  { value: "issue_closed", label: "Issue Closed" },
  { value: "deployment_succeeded", label: "Deploy Success" },
  { value: "deployment_error", label: "Deploy Error" },
] as const;

export const MODE_OPTIONS: {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    value: "fast",
    label: "Fast",
    icon: Zap,
    description: "Vector scores only (~50ms)",
  },
  {
    value: "balanced",
    label: "Auto",
    icon: Scale,
    description: "Cohere rerank (~130ms)",
  },
  {
    value: "thorough",
    label: "Thinking",
    icon: Brain,
    description: "LLM scoring (~600ms)",
  },
];

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
  dateRange?: { start: string };
} {
  if (preset === "none") return {};
  const hoursMap: Record<string, number> = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
    "72h": 72,
    "7d": 168,
    "30d": 720,
  };
  const hours = hoursMap[preset];
  if (!hours) return {};
  const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return { dateRange: { start } };
}
