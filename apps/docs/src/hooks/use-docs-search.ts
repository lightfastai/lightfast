'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SortedResult } from '~/app/(docs)/api/search/route';

// In-memory cache for GET requests (survives re-renders, cleared on page reload)
const queryCache = new Map<string, SortedResult[]>();

function useDebounce<T>(value: T, delayMs = 100): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs === 0) return;
    const handler = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(handler);
  }, [delayMs, value]);

  if (delayMs === 0) return value;
  return debouncedValue;
}

export function useDocsSearch(delayMs = 100) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SortedResult[] | 'empty'>('empty');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const debouncedQuery = useDebounce(search, delayMs);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      // Resetting state when query becomes empty is intentional —
      // this synchronizes UI state with the external "no query" condition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults('empty');
      setIsLoading(false);
      setError(undefined);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();

    const url = new URL('/api/search', window.location.origin);
    url.searchParams.set('query', debouncedQuery);
    const cacheKey = url.toString();

    // Check cache
    const cached = queryCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    void fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Search request failed');
        return res.json() as Promise<SortedResult[]>;
      })
      .then((data) => {
        queryCache.set(cacheKey, data);
        setResults(data);
        setError(undefined);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err);
        setResults('empty');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setResults('empty');
    setError(undefined);
  }, []);

  return { search, setSearch, clearSearch, results, isLoading, error };
}
