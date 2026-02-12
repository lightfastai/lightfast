'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  snippet?: string;
  score?: number;
  source?: string;
}

export function useDocsSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const json = (await response.json()) as { data?: SearchResult[] };
      setResults(json.data ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { search, results, isLoading, error, clearResults };
}
