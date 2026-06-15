"use client";

import { useMemo } from "react";
import {
  compareSignalsByRecency,
  filterClassifiedSignals,
  groupSignalsByKind,
  type SignalClassificationFilters,
  type SignalKind,
  type SignalListItem,
} from "./signals-model";

/**
 * Pure in-memory transform: filter + sort classified rows, group them by kind,
 * and sort processing rows. Memoized on `(rows, filters)` so a filter toggle
 * recomputes without any network access. Filters apply to classified rows only;
 * processing rows pass through (they are not classified yet).
 */
export function useSignalsFiltering({
  classifiedRows,
  filters,
  processingRows,
}: {
  classifiedRows: SignalListItem[];
  filters: SignalClassificationFilters;
  processingRows: SignalListItem[];
}): {
  byKind: Map<SignalKind, SignalListItem[]>;
  classified: SignalListItem[];
  processing: SignalListItem[];
} {
  const classified = useMemo(
    () => filterClassifiedSignals(classifiedRows, filters),
    [classifiedRows, filters]
  );
  const byKind = useMemo(() => groupSignalsByKind(classified), [classified]);
  const processing = useMemo(
    () => [...processingRows].sort(compareSignalsByRecency),
    [processingRows]
  );
  return { byKind, classified, processing };
}
