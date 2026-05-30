import type { AppRouterOutputs } from "@api/app";

export type SignalList =
  AppRouterOutputs["org"]["workspace"]["signals"]["list"];
export type SignalRow = SignalList["items"][number];
export type SignalStatus = SignalRow["status"];
export type SignalClassification = NonNullable<SignalRow["classification"]>;
export type SignalDisposition = SignalClassification["disposition"];
export type SignalKind = SignalClassification["kind"];
export type SignalPriority = SignalClassification["priority"];

export const SIGNALS_PAGE_SIZE = 50;

export const signalViewValues = ["list", "board"] as const;
export type SignalView = (typeof signalViewValues)[number];

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

export interface SignalSection {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  id: string;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  kind?: SignalKind;
  label: string;
  refetch: () => void;
  rows: SignalRow[];
}

export function getSignalTitle(signal: SignalRow) {
  return signal.classification?.title ?? signal.input;
}

export function getSignalSummary(signal: SignalRow) {
  return signal.classification?.summary ?? signal.input;
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

export function formatSignalIdentifier(signal: SignalRow) {
  return `SIG-${signal.id}`;
}

export function formatSignalConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export interface SignalSource {
  isApiKey: boolean;
  label: string;
}

export function getSignalSource(signal: SignalRow): SignalSource {
  if (signal.createdByApiKeyId) {
    return { isApiKey: true, label: "API key" };
  }
  return { isApiKey: false, label: "User" };
}

export function flattenSignalPages(data: { pages: SignalList[] } | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}
