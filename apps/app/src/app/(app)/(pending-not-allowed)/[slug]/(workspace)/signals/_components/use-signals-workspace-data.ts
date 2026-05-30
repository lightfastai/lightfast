"use client";

import { useMemo } from "react";
import {
  adaptProcessingRow,
  getSignalKindLabel,
  type SignalClassificationFilters,
  type SignalListItem,
  type SignalRow,
  type SignalSection,
  signalKindOptions,
} from "./signals-model";
import { useSignalsFiltering } from "./use-signals-filtering";
import {
  useProcessingSignalsQuery,
  useWorkingSetQuery,
} from "./use-classified-signals-query";

export function useSignalsWorkspaceData({
  filters,
}: {
  filters: SignalClassificationFilters;
}) {
  const { query: workingSetQuery, queryKey: workingSetQueryKey } =
    useWorkingSetQuery();
  const { query: processingQuery, queryKey: processingQueryKey } =
    useProcessingSignalsQuery();

  const classifiedRows = useMemo<SignalListItem[]>(
    () => workingSetQuery.data?.items ?? [],
    [workingSetQuery.data]
  );
  const processingFullRows = useMemo<SignalRow[]>(
    () => processingQuery.data?.items ?? [],
    [processingQuery.data]
  );
  const processingRows = useMemo<SignalListItem[]>(
    () => processingFullRows.map(adaptProcessingRow),
    [processingFullRows]
  );

  const { byKind, classified, processing } = useSignalsFiltering({
    classifiedRows,
    filters,
    processingRows,
  });

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

  const boardSections = useMemo<SignalSection[]>(
    () => [
      {
        id: "processing",
        isError: processingQuery.isError,
        isFetching: processingQuery.isFetching,
        label: "Processing",
        refetch: () => void processingQuery.refetch(),
        rows: processing,
      },
      ...signalKindOptions.map((option) => ({
        id: option.value,
        isError: workingSetQuery.isError,
        isFetching: workingSetQuery.isFetching,
        kind: option.value,
        label: getSignalKindLabel(option.value),
        refetch: () => void workingSetQuery.refetch(),
        rows: byKind.get(option.value) ?? [],
      })),
    ],
    [byKind, processing, processingQuery, workingSetQuery]
  );

  // Classified rows (projection, no body) seed the detail header; processing
  // rows are retained full (they carry `input`) so their detail needs no `get`.
  const signalsByPublicId = useMemo(() => {
    const map = new Map<string, SignalListItem | SignalRow>();
    for (const row of classifiedRows) {
      map.set(row.publicId, row);
    }
    for (const row of processingFullRows) {
      map.set(row.publicId, row);
    }
    return map;
  }, [classifiedRows, processingFullRows]);

  return {
    boardSections,
    hasAnyRows: classifiedRows.length + processingRows.length > 0,
    processingQueryKey,
    signalsByPublicId,
    totalCount: workingSetQuery.data?.totalCount ?? classifiedRows.length,
    truncated: workingSetQuery.data?.truncated ?? false,
    visibleListSections,
    workingSetQueryKey,
  };
}
