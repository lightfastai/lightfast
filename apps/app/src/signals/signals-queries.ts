import {
  createSignal,
  getSignal,
  listProcessingSignals,
  listWorkingSetSignals,
  type ListProcessingSignalsResult,
  type ListWorkingSetSignalsResult,
  type SignalDetailResult,
} from "@api/app/tanstack/signals";
import {
  keepPreviousData,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
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

export function createSignalMutationOptions(input: {
  draftStorageKey: string;
  onClose: () => void;
  onCreateMore: () => void;
  queryClient: QueryClient;
  removeDraft: (storageKey: string) => void;
  resetInput: () => void;
  shouldCreateMore: () => boolean;
  toastSuccess: () => void;
}) {
  return {
    meta: { errorTitle: "Failed to create signal" },
    mutationFn: (data: { input: string }) => createSignal({ data }),
    onSuccess: () => {
      input.removeDraft(input.draftStorageKey);
      void input.queryClient.invalidateQueries({
        queryKey: signalQueryKeys.workingSet(),
      });
      void input.queryClient.invalidateQueries({
        queryKey: signalQueryKeys.processing(),
      });
      input.toastSuccess();
      input.resetInput();
      if (input.shouldCreateMore()) {
        input.onCreateMore();
        return;
      }
      input.onClose();
    },
  };
}
