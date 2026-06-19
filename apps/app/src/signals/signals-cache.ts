import type {
  ListProcessingSignalsResult,
  ListWorkingSetSignalsResult,
  SignalDetailResult,
} from "@api/app/tanstack/signals";
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
