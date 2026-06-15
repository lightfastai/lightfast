import type { AppRouterOutputs } from "@api/app";

/** Full row from the cursor `list` query (processing path) — carries body fields. */
export type SignalList =
  AppRouterOutputs["org"]["workspace"]["signals"]["list"];
export type SignalRow = SignalList["items"][number];

/** Projected working-set row (classified, no body). */
export type WorkspaceSignals =
  AppRouterOutputs["org"]["workspace"]["signals"]["workingSet"];
export type WorkspaceSignalRow = WorkspaceSignals["items"][number];

/** Full row from `get` — used for the detail body. */
export type SignalDetailRow =
  AppRouterOutputs["org"]["workspace"]["signals"]["get"];

/**
 * Canonical view-row type for list/grouping. It is the projected
 * working-set row plus an optional client-computed `inputPreview` (populated only
 * when adapting a processing row). Classified rows always have
 * `classification.title`, so they leave `inputPreview` undefined.
 */
export type SignalListItem = WorkspaceSignalRow & { inputPreview?: string };

export type SignalStatus = SignalRow["status"];
export type SignalClassification = NonNullable<SignalRow["classification"]>;
export type SignalDisposition = SignalClassification["disposition"];
export type SignalKind = SignalClassification["kind"];
export type SignalPriority = SignalClassification["priority"];

export const SIGNALS_PAGE_SIZE = 50;
export const PROCESSING_SIGNALS_LIMIT = 100;

export const signalProcessingStatuses = [
  "queued",
  "processing",
] as const satisfies readonly SignalStatus[];

export const signalStatusLabels: Record<SignalStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  classified: "Classified",
  failed: "Failed",
};

export const signalDispositionOptions: {
  label: string;
  value: SignalDisposition;
}[] = [
  { label: "Actionable", value: "actionable" },
  { label: "Needs context", value: "needs_context" },
  { label: "Not actionable", value: "not_actionable" },
];

export const signalKindOptions: {
  label: string;
  value: SignalKind;
}[] = [
  { label: "Engage", value: "engage" },
  { label: "Follow up", value: "follow_up" },
  { label: "Review", value: "review" },
  { label: "Fix", value: "fix" },
  { label: "Investigate", value: "investigate" },
  { label: "Remember", value: "remember" },
  { label: "Other", value: "other" },
];

export const signalPriorityOptions: {
  label: string;
  value: SignalPriority;
}[] = [
  { label: "Urgent", value: "urgent" },
  { label: "High", value: "high" },
  { label: "Normal", value: "normal" },
  { label: "Low", value: "low" },
];

export interface SignalClassificationFilters {
  dispositions: SignalDisposition[];
  kinds: SignalKind[];
  peopleRouted: boolean;
  priorities: SignalPriority[];
}

/**
 * A grouped, already-filtered set of view rows for one list section. No
 * pagination fields — the working set is fetched in one shot.
 */
export interface SignalSection {
  id: string;
  isError: boolean;
  isFetching: boolean;
  label: string;
  refetch: () => void;
  rows: SignalListItem[];
}

// ---------------------------------------------------------------------------
// Client filtering / sorting / grouping — the single tested source of truth.
// These mirror the (now dormant) server SQL branches; the server branches have
// no consumer after this refactor, so there is no SQL↔client parity test.
// ---------------------------------------------------------------------------

export function signalMatchesFilters(
  item: SignalListItem,
  filters: SignalClassificationFilters
): boolean {
  const classification = item.classification;
  if (!classification) {
    return false;
  }
  if (
    filters.kinds.length > 0 &&
    !filters.kinds.includes(classification.kind)
  ) {
    return false;
  }
  if (
    filters.priorities.length > 0 &&
    !filters.priorities.includes(classification.priority)
  ) {
    return false;
  }
  if (
    filters.dispositions.length > 0 &&
    !filters.dispositions.includes(classification.disposition)
  ) {
    return false;
  }
  if (
    filters.peopleRouted &&
    classification.routing.routes.people.shouldRun !== true
  ) {
    return false;
  }
  return true;
}

/** Newest first: createdAt desc, then id desc (matches `orderBy(desc(createdAt), desc(id))`). */
export function compareSignalsByRecency(
  a: SignalListItem,
  b: SignalListItem
): number {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.id - a.id;
}

export function filterClassifiedSignals(
  rows: SignalListItem[],
  filters: SignalClassificationFilters
): SignalListItem[] {
  return rows
    .filter((row) => signalMatchesFilters(row, filters))
    .sort(compareSignalsByRecency);
}

export function groupSignalsByKind(
  rows: SignalListItem[]
): Map<SignalKind, SignalListItem[]> {
  const byKind = new Map<SignalKind, SignalListItem[]>();
  for (const row of rows) {
    const kind = row.classification?.kind;
    if (!kind) {
      continue;
    }
    const bucket = byKind.get(kind);
    if (bucket) {
      bucket.push(row);
    } else {
      byKind.set(kind, [row]);
    }
  }
  return byKind;
}

/**
 * Adapt a full processing row (`queued`/`processing`, from `list`) into the view
 * type: no classification, a 200-char `inputPreview`, and crucially **no `input`
 * field** so `"input" in item` stays false for view-layer rows. The full row is
 * retained separately (in `signalsByPublicId`) for the detail body.
 */
export function adaptProcessingRow(row: SignalRow): SignalListItem {
  return {
    classification: null,
    createdAt: row.createdAt,
    createdByApiKeyId: row.createdByApiKeyId,
    createdByUserId: row.createdByUserId,
    id: row.id,
    inputPreview: row.input.slice(0, 200),
    publicId: row.publicId,
    status: row.status,
  };
}

// ---------------------------------------------------------------------------
// Display helpers (now typed against the projected view row).
// ---------------------------------------------------------------------------

export function getSignalTitle(item: SignalListItem) {
  return (
    item.classification?.title ??
    item.inputPreview ??
    formatSignalIdentifier(item)
  );
}

export function getSignalSummary(item: SignalListItem) {
  return item.classification?.summary ?? item.inputPreview ?? "";
}

export function getSignalKindLabel(kind: SignalKind) {
  return (
    signalKindOptions.find((option) => option.value === kind)?.label ?? kind
  );
}

export function getSignalStatusLabel(status: SignalStatus) {
  return signalStatusLabels[status];
}

export function getSignalPriorityLabel(priority: SignalPriority) {
  return (
    signalPriorityOptions.find((option) => option.value === priority)?.label ??
    priority
  );
}

export function getSignalDispositionLabel(disposition: SignalDisposition) {
  return (
    signalDispositionOptions.find((option) => option.value === disposition)
      ?.label ?? disposition
  );
}

export function formatSignalIdentifier(item: Pick<SignalListItem, "id">) {
  return `SIG-${item.id}`;
}

export function formatSignalConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Absolute creation date for signal rows/cards, e.g. "May 30". The year is
 * appended only when it differs from the current year. Formatted in UTC to keep
 * server and client output identical (no hydration drift).
 */
export function formatSignalDate(value: Date | number | string) {
  const date = new Date(value);
  const isCurrentYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}

export interface SignalSource {
  isApiKey: boolean;
  label: string;
}

export function getSignalSource(
  item: Pick<SignalListItem, "createdByApiKeyId">
): SignalSource {
  if (item.createdByApiKeyId) {
    return { isApiKey: true, label: "API key" };
  }
  return { isApiKey: false, label: "User" };
}
