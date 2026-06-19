import {
  listProcessingSignals,
  listWorkingSetSignals,
} from "@api/app/tanstack/signals";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  adaptProcessingRow,
  compareSignalsByRecency,
  filterClassifiedSignals,
  PROCESSING_SIGNALS_LIMIT,
  type SignalClassificationFilters,
  type SignalListItem,
  type SignalRow,
  type SignalSection,
  signalProcessingStatuses,
} from "./signals-model";
import { signalQueryKeys } from "./signals-queries";

const WORKING_SET_REFETCH_MS = 30_000;
const PROCESSING_REFETCH_MS = 5000;

export function useSignalsWorkspaceData({
  filters,
}: {
  filters: SignalClassificationFilters;
}) {
  const workingSetQueryKey = signalQueryKeys.workingSet();
  const processingQueryKey = signalQueryKeys.processing();
  const workingSetQuery = useQuery({
    enabled: typeof window !== "undefined",
    placeholderData: keepPreviousData,
    queryFn: () => listWorkingSetSignals(),
    queryKey: workingSetQueryKey,
    refetchInterval: WORKING_SET_REFETCH_MS,
    staleTime: WORKING_SET_REFETCH_MS,
  });
  const processingQuery = useQuery({
    enabled: typeof window !== "undefined",
    placeholderData: keepPreviousData,
    queryFn: () =>
      listProcessingSignals({
        data: {
          limit: PROCESSING_SIGNALS_LIMIT,
          statuses: [...signalProcessingStatuses],
        },
      }),
    queryKey: processingQueryKey,
    refetchInterval: PROCESSING_REFETCH_MS,
    staleTime: PROCESSING_REFETCH_MS,
  });

  const classifiedRows = useMemo<SignalListItem[]>(
    () => workingSetQuery.data?.items ?? [],
    [workingSetQuery.data]
  );
  const processingFullRows = useMemo<SignalRow[]>(
    () => processingQuery.data?.items ?? [],
    [processingQuery.data]
  );
  const classifiedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of classifiedRows) {
      ids.add(row.publicId);
    }
    return ids;
  }, [classifiedRows]);
  const dedupedProcessingFullRows = useMemo<SignalRow[]>(
    () => processingFullRows.filter((row) => !classifiedIds.has(row.publicId)),
    [classifiedIds, processingFullRows]
  );
  const processingRows = useMemo<SignalListItem[]>(
    () => dedupedProcessingFullRows.map(adaptProcessingRow),
    [dedupedProcessingFullRows]
  );
  const classified = useMemo(
    () => filterClassifiedSignals(classifiedRows, filters),
    [classifiedRows, filters]
  );
  const processing = useMemo(
    () => [...processingRows].sort(compareSignalsByRecency),
    [processingRows]
  );

  const visibleListSections = useMemo<SignalSection[]>(
    () => [
      {
        id: "classified",
        isError: workingSetQuery.isError,
        isFetching: workingSetQuery.isFetching,
        label: "Classified",
        refetch: () => void workingSetQuery.refetch(),
        rows: classified,
      },
      {
        id: "processing",
        isError: processingQuery.isError,
        isFetching: processingQuery.isFetching,
        label: "Processing",
        refetch: () => void processingQuery.refetch(),
        rows: processing,
      },
    ],
    [classified, processing, workingSetQuery, processingQuery]
  );

  // Classified rows (projection, no body) seed the detail header; processing
  // rows are retained full (they carry `input`) so their detail needs no `get`.
  const signalsByPublicId = useMemo(() => {
    const map = new Map<string, SignalListItem | SignalRow>();
    for (const row of classifiedRows) {
      map.set(row.publicId, row);
    }
    for (const row of dedupedProcessingFullRows) {
      map.set(row.publicId, row);
    }
    return map;
  }, [classifiedRows, dedupedProcessingFullRows]);

  const hasAnyRows = classifiedRows.length + processingRows.length > 0;

  return {
    hasAnyRows,
    isInitialPending:
      !hasAnyRows && (workingSetQuery.isPending || processingQuery.isPending),
    limit: workingSetQuery.data?.limit ?? 2000,
    processingQueryKey,
    signalsByPublicId,
    totalCount: workingSetQuery.data?.totalCount ?? classifiedRows.length,
    truncated: workingSetQuery.data?.truncated ?? false,
    visibleListSections,
    windowDays: workingSetQuery.data?.windowDays ?? 30,
    workingSetQueryKey,
  };
}
