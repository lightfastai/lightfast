import {
  getSignal,
  type ListProcessingSignalsResult,
  type ListWorkingSetSignalsResult,
  listProcessingSignals,
  listWorkingSetSignals,
  type SignalDetailResult,
} from "@api/app/tanstack/signals";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./signals-model";

const WORKING_SET_REFETCH_MS = 30_000;
const PROCESSING_REFETCH_MS = 5000;

export type ProcessingSignalsResult = ListProcessingSignalsResult;
export type WorkingSetSignalsResult = ListWorkingSetSignalsResult;
export type SignalDetailQueryResult = SignalDetailResult;

export const signalQueryKeys = {
  all: ["signals"] as const,
  detail: (publicId: string) => ["signals", "detail", publicId] as const,
  processing: () =>
    [
      "signals",
      "processing",
      { limit: PROCESSING_SIGNALS_LIMIT, statuses: signalProcessingStatuses },
    ] as const,
  workingSet: () => ["signals", "working-set"] as const,
};

export function workingSetSignalsQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    placeholderData: keepPreviousData,
    queryFn: () => listWorkingSetSignals(),
    queryKey: signalQueryKeys.workingSet(),
    refetchInterval: WORKING_SET_REFETCH_MS,
    staleTime: WORKING_SET_REFETCH_MS,
  });
}

export function processingSignalsQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    placeholderData: keepPreviousData,
    queryFn: () =>
      listProcessingSignals({
        data: {
          limit: PROCESSING_SIGNALS_LIMIT,
          statuses: [...signalProcessingStatuses],
        },
      }),
    queryKey: signalQueryKeys.processing(),
    refetchInterval: PROCESSING_REFETCH_MS,
    staleTime: PROCESSING_REFETCH_MS,
  });
}

export function signalDetailQueryOptions(input: {
  enabled: boolean;
  publicId: string;
}) {
  return queryOptions({
    enabled: typeof window !== "undefined" && input.enabled,
    queryFn: () => getSignal({ data: { publicId: input.publicId } }),
    queryKey: signalQueryKeys.detail(input.publicId),
  });
}
