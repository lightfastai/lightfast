"use client";

import { useMemo } from "react";
import {
  flattenSignalPages,
  getSignalKindLabel,
  type SignalClassificationFilters,
  type SignalKind,
  type SignalRow,
  type SignalSection,
  signalKindOptions,
  signalProcessingStatuses,
} from "./signals-model";
import { useSignalsListQuery } from "./use-classified-signals-query";

export function useSignalsWorkspaceData({
  filters,
  search,
}: {
  filters: SignalClassificationFilters;
  search: string;
}) {
  const { query: processingQuery, queryKey: processingQueryKey } =
    useSignalsListQuery({
      refetchInterval: 5_000,
      search,
      staleTime: 5_000,
      statuses: signalProcessingStatuses,
    });
  const {
    data: processingData,
    fetchNextPage: fetchNextProcessingPage,
    hasNextPage: hasNextProcessingPage,
    isError: isProcessingError,
    isFetching: isProcessingFetching,
    isFetchingNextPage: isFetchingNextProcessingPage,
    refetch: refetchProcessing,
  } = processingQuery;

  const processingRows = useMemo(
    () => flattenSignalPages(processingData),
    [processingData]
  );

  const { query: classifiedQuery, queryKey: classifiedQueryKey } =
    useSignalsListQuery({
      filters,
      refetchInterval: processingRows.length > 0 ? 5_000 : false,
      search,
      status: "classified",
    });
  const {
    data: classifiedData,
    fetchNextPage: fetchNextClassifiedPage,
    hasNextPage: hasNextClassifiedPage,
    isError: isClassifiedError,
    isFetching: isClassifiedFetching,
    isFetchingNextPage: isFetchingNextClassifiedPage,
    refetch: refetchClassified,
  } = classifiedQuery;

  const classifiedRows = useMemo(
    () => flattenSignalPages(classifiedData),
    [classifiedData]
  );

  const classifiedSection = useMemo<SignalSection>(
    () => ({
      fetchNextPage: () => void fetchNextClassifiedPage(),
      hasNextPage: !!hasNextClassifiedPage,
      id: "classified",
      isError: isClassifiedError,
      isFetching: isClassifiedFetching,
      isFetchingNextPage: isFetchingNextClassifiedPage,
      label: "Classified",
      refetch: () => void refetchClassified(),
      rows: classifiedRows,
    }),
    [
      classifiedRows,
      fetchNextClassifiedPage,
      hasNextClassifiedPage,
      isClassifiedError,
      isClassifiedFetching,
      isFetchingNextClassifiedPage,
      refetchClassified,
    ]
  );

  const processingSection = useMemo<SignalSection>(
    () => ({
      fetchNextPage: () => void fetchNextProcessingPage(),
      hasNextPage: !!hasNextProcessingPage,
      id: "processing",
      isError: isProcessingError,
      isFetching: isProcessingFetching,
      isFetchingNextPage: isFetchingNextProcessingPage,
      label: "Processing",
      refetch: () => void refetchProcessing(),
      rows: processingRows,
    }),
    [
      fetchNextProcessingPage,
      hasNextProcessingPage,
      isFetchingNextProcessingPage,
      isProcessingError,
      isProcessingFetching,
      processingRows,
      refetchProcessing,
    ]
  );

  const rowsByKind = useMemo(
    () => groupRowsByKind(classifiedRows),
    [classifiedRows]
  );

  const boardSections = useMemo<SignalSection[]>(
    () => [
      processingSection,
      ...signalKindOptions.map((option) => ({
        fetchNextPage: () => void fetchNextClassifiedPage(),
        hasNextPage: !!hasNextClassifiedPage,
        id: option.value,
        isError: isClassifiedError,
        isFetching: isClassifiedFetching,
        isFetchingNextPage: isFetchingNextClassifiedPage,
        kind: option.value,
        label: getSignalKindLabel(option.value),
        refetch: () => void refetchClassified(),
        rows: rowsByKind.get(option.value) ?? [],
      })),
    ],
    [
      fetchNextClassifiedPage,
      hasNextClassifiedPage,
      isClassifiedError,
      isClassifiedFetching,
      isFetchingNextClassifiedPage,
      processingSection,
      refetchClassified,
      rowsByKind,
    ]
  );
  const visibleListSections = useMemo(
    () => [classifiedSection, processingSection],
    [classifiedSection, processingSection]
  );

  const signalsByPublicId = useMemo(() => {
    const map = new Map<string, SignalRow>();
    for (const row of processingRows) {
      map.set(row.publicId, row);
    }
    for (const row of classifiedRows) {
      map.set(row.publicId, row);
    }
    return map;
  }, [classifiedRows, processingRows]);

  return {
    boardSections,
    classifiedListQueryKey: classifiedQueryKey,
    hasAnyRows: classifiedRows.length + processingRows.length > 0,
    isFetchingAny: isClassifiedFetching || isProcessingFetching,
    processingListQueryKey: processingQueryKey,
    signalsByPublicId,
    visibleListSections,
  };
}

function groupRowsByKind(rows: SignalRow[]) {
  const rowsByKind = new Map<SignalKind, SignalRow[]>();

  for (const row of rows) {
    const kind = row.classification?.kind;
    if (!kind) {
      continue;
    }
    const kindRows = rowsByKind.get(kind);
    if (kindRows) {
      kindRows.push(row);
    } else {
      rowsByKind.set(kind, [row]);
    }
  }

  return rowsByKind;
}
