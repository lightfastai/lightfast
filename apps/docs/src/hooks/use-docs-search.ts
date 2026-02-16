'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SortedResult } from '~/app/(docs)/api/search/route';

export type { SortedResult };

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
  const onStartRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    // Cancel previous in-flight request
    if (onStartRef.current) {
      onStartRef.current();
      onStartRef.current = undefined;
    }

    if (!debouncedQuery.trim()) {
      setResults('empty');
      setIsLoading(false);
      setError(undefined);
      return;
    }

    setIsLoading(true);
    let interrupt = false;
    onStartRef.current = () => {
      interrupt = true;
    };

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

    void fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Search request failed');
        return res.json() as Promise<SortedResult[]>;
      })
      .then((data) => {
        if (interrupt) return;
        queryCache.set(cacheKey, data);
        setResults(data);
        setError(undefined);
      })
      .catch((err: Error) => {
        if (interrupt) return;
        setError(err);
        setResults('empty');
      })
      .finally(() => {
        if (!interrupt) setIsLoading(false);
      });
  }, [debouncedQuery]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setResults('empty');
    setError(undefined);
  }, []);

  return { search, setSearch, clearSearch, results, isLoading, error };
}
