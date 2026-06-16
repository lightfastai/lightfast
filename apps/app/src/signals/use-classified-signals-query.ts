import { useQuery } from "@tanstack/react-query";
import {
  processingSignalsQueryOptions,
  workingSetSignalsQueryOptions,
} from "./signals-queries";

/**
 * Bounded, projected classified working set — fetched once, unfiltered. Filters
 * never enter the query key, so toggling a filter triggers no network request.
 * A fixed 30s interval surfaces newly-classified signals.
 */
export function useWorkingSetQuery() {
  const options = workingSetSignalsQueryOptions();
  return { query: useQuery(options), queryKey: options.queryKey };
}

/**
 * Small `queued`/`processing` query, single page, polled every 5s. No
 * classification filters (those rows are not classified yet).
 */
export function useProcessingSignalsQuery() {
  const options = processingSignalsQueryOptions();
  return { query: useQuery(options), queryKey: options.queryKey };
}
