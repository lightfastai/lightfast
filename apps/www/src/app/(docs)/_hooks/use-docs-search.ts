"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import type { SortedResult } from "~/app/(docs)/_types/search";

function useDebounce<T>(value: T, delayMs = 100): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (delayMs === 0) {
      return;
    }
    const handler = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(handler);
  }, [delayMs, value]);

  if (delayMs === 0) {
    return value;
  }
  return debouncedValue;
}

async function searchFetcher(url: string): Promise<SortedResult[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Search request failed");
  }
  return res.json() as Promise<SortedResult[]>;
}

export function useDocsSearch(delayMs = 100) {
  const [search, setSearch] = useState("");
  const debouncedQuery = useDebounce(search, delayMs);

  const swrKey = debouncedQuery.trim()
    ? `/api/search?query=${encodeURIComponent(debouncedQuery)}`
    : null;

  const { data, isLoading, error } = useSWR<SortedResult[], Error>(
    swrKey,
    searchFetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const results: SortedResult[] | "empty" =
    swrKey === null ? "empty" : (data ?? "empty");

  const clearSearch = useCallback(() => {
    setSearch("");
  }, []);

  return { search, setSearch, clearSearch, results, isLoading, error };
}
