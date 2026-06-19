import {
  getSignal,
  type ListProcessingSignalsResult,
  type ListWorkingSetSignalsResult,
  type SignalDetailResult,
} from "@api/app/tanstack/signals";
import { queryOptions } from "@tanstack/react-query";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./signals-model";

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
