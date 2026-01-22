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

// Types for the Mixedbread API response
interface MixedbreadMetadata {
  file_path?: string;
  synced?: boolean;
  git_branch?: string;
  git_commit?: string;
  uploaded_at?: string;
}

interface MixedbreadGeneratedMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  type?: string;
  file_type?: string;
  language?: string;
  word_count?: number;
}

interface MixedbreadSearchItem {
  file_id: string;
  chunk_index: number;
  filename: string;
  score: number;
  text?: string;
  metadata?: MixedbreadMetadata;
  generated_metadata?: MixedbreadGeneratedMetadata;
}

interface SearchApiResponse {
  data?: MixedbreadSearchItem[];
  error?: string;
}

// Module-level cache for search results
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

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
      // Call our server-side API route instead of Mixedbread directly
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const json = await response.json() as SearchApiResponse;

      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      // Transform results to our format
      const items = json.data ?? [];
      const searchResults: SearchResult[] = items.map((item) => {
        // Mixedbread returns:
        // - item.metadata: { file_path, synced, git_branch, ... }
        // - item.generated_metadata: { title, description, keywords, ... } (from MDX frontmatter)
        // - item.filename: just the filename (e.g., "quickstart.mdx")
        const metadata = item.metadata;
        const generatedMetadata = item.generated_metadata;

        // Get title from generated_metadata (MDX frontmatter) or fallback to filename
        const title = generatedMetadata?.title ??
                     item.filename.replace(/\.mdx?$/, '').replace(/-/g, ' ');

        // Get description from generated_metadata
        const description = generatedMetadata?.description;

        // Build URL from metadata.file_path which contains the full path
        // e.g., "/Users/.../apps/docs/src/content/docs/get-started/quickstart.mdx" -> "/docs/get-started/quickstart"
        let url = '';
        const filePath = metadata?.file_path ?? '';
        if (filePath) {
          if (filePath.includes('content/docs/')) {
            const pathPart = filePath.split('content/docs/')[1] ?? '';
            url = '/docs/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
          } else if (filePath.includes('content/api/')) {
            const pathPart = filePath.split('content/api/')[1] ?? '';
            url = '/docs/api/' + pathPart.replace(/\.mdx?$/, '').replace(/\/index$/, '');
          }
        }
        // Fallback to filename if file_path not available
        if (!url && item.filename) {
          url = '/docs/' + item.filename.replace(/\.mdx?$/, '');
        }

        // Get snippet from chunk text (strip frontmatter)
        let snippet: string | undefined;
        if (item.text) {
          // Remove YAML frontmatter if present
          const withoutFrontmatter = item.text.replace(/^---[\s\S]*?---\s*/, '');
          snippet = withoutFrontmatter.substring(0, 200).trim();
        }

        // Determine source from file path
        let source = 'Documentation';
        if (filePath.includes('content/api/')) {
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
