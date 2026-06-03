import type { AppRouterOutputs } from "@api/app";
import { formatUtcCalendarDate } from "@vendor/lib/time";

export type DecisionsList =
  AppRouterOutputs["org"]["workspace"]["decisions"]["list"];
export type DecisionRow = DecisionsList["items"][number];
export type DecisionProvider = DecisionRow["provider"];
export type DecisionStatus = DecisionRow["status"];
export type DecisionSourceSurface = DecisionRow["sourceSurface"];

export const DECISIONS_PAGE_SIZE = 50;

export const decisionProviderOptions: {
  label: string;
  value: DecisionProvider;
}[] = [
  { label: "Linear", value: "linear" },
  { label: "X", value: "x" },
];

export const decisionStatusOptions: {
  label: string;
  value: DecisionStatus;
}[] = [
  { label: "Succeeded", value: "succeeded" },
  { label: "Running", value: "running" },
  { label: "Failed", value: "failed" },
];

export interface DecisionFilters {
  providers: DecisionProvider[];
  statuses: DecisionStatus[];
}

export interface DecisionStatusMeta {
  label: string;
  rail: string; // left-rail border color
  tone: string; // glyph color classes
}

const STATUS_META: Record<DecisionStatus, DecisionStatusMeta> = {
  failed: {
    label: "Failed",
    tone: "text-destructive",
    rail: "border-l-destructive",
  },
  running: {
    label: "Running",
    tone: "animate-spin text-amber-500",
    rail: "border-l-amber-500",
  },
  succeeded: {
    label: "Succeeded",
    tone: "text-emerald-500",
    rail: "border-l-emerald-500",
  },
};

export function getDecisionStatusMeta(
  status: DecisionStatus
): DecisionStatusMeta {
  return STATUS_META[status];
}

export function getDecisionProviderLabel(provider: DecisionProvider) {
  return (
    decisionProviderOptions.find((option) => option.value === provider)
      ?.label ?? provider
  );
}

export function getDecisionStatusLabel(status: DecisionStatus) {
  return (
    decisionStatusOptions.find((option) => option.value === status)?.label ??
    status
  );
}

export function formatCaller(decision: DecisionRow): string {
  if (decision.calledByKind === "automation") {
    return `Automation ${decision.calledById}`;
  }
  if (decision.calledByKind === "user") {
    return `User ${decision.calledByUserId ?? decision.calledById}`;
  }
  return `System ${decision.calledById}`;
}

const SOURCE_LABELS: Record<DecisionSourceSurface, string> = {
  automation: "Automation",
  chat: "Chat",
  hosted_mcp: "Hosted MCP",
  native_cli: "Native CLI",
  system: "System",
};

export function getSourceLabel(surface: DecisionSourceSurface): string {
  return SOURCE_LABELS[surface] ?? surface;
}

export function flattenDecisionPages(
  data: { pages: DecisionsList[] } | undefined
): DecisionRow[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export interface DecisionDayGroup {
  failureCount: number;
  key: string;
  label: string;
  rows: DecisionRow[];
}

function utcDayStart(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate()
  );
}

/**
 * Groups loaded (already createdAt-desc) rows by the UTC calendar day of
 * `startedAt` — the value shown in the Started column. `now` is injectable for
 * deterministic tests. Group order follows first appearance, which is newest
 * day first because the input is descending.
 */
export function groupDecisionsByDay(
  rows: DecisionRow[],
  now: Date = new Date()
): DecisionDayGroup[] {
  const todayKey = utcDayStart(now);
  const yesterdayKey = todayKey - 86_400_000;
  const groups: DecisionDayGroup[] = [];
  const byKey = new Map<number, DecisionDayGroup>();

  for (const row of rows) {
    const dayKey = utcDayStart(row.startedAt);
    let group = byKey.get(dayKey);
    if (!group) {
      const label =
        dayKey === todayKey
          ? "Today"
          : dayKey === yesterdayKey
            ? "Yesterday"
            : (formatUtcCalendarDate(dayKey) ?? "Unknown");
      group = { key: String(dayKey), label, failureCount: 0, rows: [] };
      byKey.set(dayKey, group);
      groups.push(group);
    }
    group.rows.push(row);
    if (row.status === "failed") {
      group.failureCount += 1;
    }
  }

  return groups;
}
