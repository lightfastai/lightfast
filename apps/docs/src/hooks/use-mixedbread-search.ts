'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Mixedbread from '@mixedbread/sdk';
import { env } from '~/env';

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  snippet?: string;
  score?: number;
  source?: string;
}

// Module-level cache for search results
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

// Initialize Mixedbread client (lazy initialization)
let mxbaiClient: Mixedbread | null = null;

function getMxbaiClient(): Mixedbread {
  if (mxbaiClient) return mxbaiClient;
  mxbaiClient = new Mixedbread({ apiKey: env.NEXT_PUBLIC_MXBAI_API_KEY });
  return mxbaiClient;
}

export function useMixedbreadSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.results);
      setError(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const client = getMxbaiClient();

      // Use Mixedbread store search
      const response = await client.stores.search({
        query,
        store_identifiers: [env.NEXT_PUBLIC_MXBAI_STORE_ID],
        top_k: 10,
      });

      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Transform results to our format
      const searchResults: SearchResult[] = response.data.map((item) => {
        // Extract metadata - the file metadata contains the MDX frontmatter
        const metadata = item.metadata as Record<string, unknown> | undefined;

        // Get title from metadata or filename
        const title = (metadata?.title as string) ||
                     (metadata?.name as string) ||
                     item.filename.replace(/\.mdx?$/, '').replace(/-/g, ' ') ||
                     'Untitled';

        // Get description from metadata
        const description = (metadata?.description as string) || undefined;

        // Build URL from filename/metadata
        // MDX files are typically in src/content/docs/ or src/content/api/
        let url = (metadata?.url as string) || (metadata?.slug as string) || '';
        if (!url) {
          // Convert filename to URL path
          // e.g., "src/content/docs/getting-started.mdx" -> "/docs/getting-started"
          const filename = item.filename;
          if (filename.includes('content/docs/')) {
            const pathPart = filename.split('content/docs/')[1];
            url = '/docs/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
          } else if (filename.includes('content/api/')) {
            const pathPart = filename.split('content/api/')[1];
            url = '/docs/api/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
          } else {
            url = '/docs/' + filename.replace(/\.mdx?$/, '');
          }
        }

        // Get snippet from chunk text
        const snippet = 'text' in item ? item.text.substring(0, 200) : undefined;

        // Determine source from path or metadata
        let source = (metadata?.source as string) || 'Documentation';
        if (item.filename.includes('content/api/')) {
          source = 'API Reference';
        }

        return {
          id: `${item.file_id}-${item.chunk_index}`,
          title,
          description,
          url,
          snippet,
          score: item.score,
          source,
        };
      });

      // Deduplicate results by URL (keep highest scoring)
      const seenUrls = new Map<string, SearchResult>();
      for (const result of searchResults) {
        const existing = seenUrls.get(result.url);
        if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
          seenUrls.set(result.url, result);
        }
      }
      const deduplicatedResults = Array.from(seenUrls.values());

      // Update cache
      searchCache.set(cacheKey, {
        results: deduplicatedResults,
        timestamp: Date.now(),
      });

      // Clean up old cache entries
      if (searchCache.size > 50) {
        const entries = Array.from(searchCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const [[oldestKey]] = entries;
        searchCache.delete(oldestKey);
      }

      setResults(deduplicatedResults);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (currentRequestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    search,
    results,
    isLoading,
    error,
    clearResults,
  };
}
