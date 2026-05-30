"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./signals-model";

const WORKING_SET_REFETCH_MS = 30_000;
const PROCESSING_REFETCH_MS = 5000;

/**
 * Bounded, projected classified working set — fetched once, unfiltered. Filters
 * never enter the query key, so toggling a filter triggers no network request.
 * A fixed 30s interval surfaces newly-classified signals.
 */
export function useWorkingSetQuery() {
  const trpc = useTRPC();
  const options = {
    ...trpc.org.workspace.signals.workingSet.queryOptions(),
    placeholderData: keepPreviousData,
    refetchInterval: WORKING_SET_REFETCH_MS,
    staleTime: WORKING_SET_REFETCH_MS,
  };
  return { query: useQuery(options), queryKey: options.queryKey };
}

/**
 * Small `queued`/`processing` query, single page, polled every 5s. No
 * classification filters (those rows are not classified yet).
 */
export function useProcessingSignalsQuery() {
  const trpc = useTRPC();
  const options = {
    ...trpc.org.workspace.signals.list.queryOptions({
      limit: PROCESSING_SIGNALS_LIMIT,
      statuses: [...signalProcessingStatuses],
    }),
    placeholderData: keepPreviousData,
    refetchInterval: PROCESSING_REFETCH_MS,
    staleTime: PROCESSING_REFETCH_MS,
  };
  return { query: useQuery(options), queryKey: options.queryKey };
}
