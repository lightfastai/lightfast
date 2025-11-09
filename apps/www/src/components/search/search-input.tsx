"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { SearchResults } from "./search-results";
import { useTextCycle } from "~/hooks/use-text-cycle";

interface SearchResult {
  documentId: string;
  chunkId: string;
  score: number;
  title: string;
  type: string;
  source: string;
  occurredAt: string;
  author: string;
  sectionLabel?: string;
  highlight: string;
  url: string;
}

// Mock data based on API_SPEC.md
const MOCK_RESULTS: SearchResult[] = [
  {
    documentId: "doc_abc",
    chunkId: "chnk_001",
    score: 0.83,
    title: "Incident 42: Billing outage",
    type: "Page",
    source: "Notion",
    occurredAt: "2025-09-22T10:11:00.000Z",
    author: "alice@example.com",
    sectionLabel: "Summary",
    highlight:
      "Root cause related to Stripe webhook retries and idempotency handling. The billing service experienced downtime due to webhook processing delays.",
    url: "https://notion.so/incident-42",
  },
  {
    documentId: "doc_def",
    chunkId: "chnk_002",
    score: 0.78,
    title: "Chat model feedback",
    type: "Page",
    source: "GitHub",
    occurredAt: "2025-08-15T14:22:00.000Z",
    author: "bob@example.com",
    sectionLabel: "Discussion",
    highlight:
      "We've deprecated this web form in favor of other channels for feedback about ChatGPT. Users can now provide feedback through the main dashboard.",
    url: "https://github.com/example/feedback",
  },
  {
    documentId: "doc_ghi",
    chunkId: "chnk_003",
    score: 0.75,
    title: "Delivering high-performance customer support",
    type: "API",
    source: "Notion",
    occurredAt: "2025-07-10T09:30:00.000Z",
    author: "carol@example.com",
    sectionLabel: "Case Study",
    highlight:
      "Decagon uses OpenAI's models for automated customer support for many companies with scalable solutions. Integration with our API enables real-time responses.",
    url: "https://notion.so/case-study-decagon",
  },
  {
    documentId: "doc_jkl",
    chunkId: "chnk_004",
    score: 0.71,
    title: "API Platform",
    type: "Page",
    source: "GitHub",
    occurredAt: "2025-06-05T16:45:00.000Z",
    author: "dave@example.com",
    sectionLabel: "Overview",
    highlight:
      "The all-in-one platform for agents to build, deploy, and optimize AI experiences with advanced models. Supports multiple embedding models and vector search.",
    url: "https://github.com/example/api-platform",
  },
];

export function SearchInput() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotating placeholder messages
  const PLACEHOLDERS = [
    "Ask me about our team.",
    "Ask me about our mission.",
    "Ask me about our docs.",
  ] as const;
  const { currentItem: rotatingPlaceholder, start } = useTextCycle(
    PLACEHOLDERS,
    {
      interval: 2000,
      loop: true,
    },
  );

  // Track previous placeholder to animate it out
  const [prevPlaceholder, setPrevPlaceholder] = useState<string | undefined>(
    undefined,
  );
  const rotationCounterRef = useRef(0);
  const lastShownRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (rotatingPlaceholder === undefined) return;

    // The previous value becomes the slide-out text
    setPrevPlaceholder(lastShownRef.current);
    // Update the last shown ref to the new value
    lastShownRef.current = rotatingPlaceholder;

    // Bump counter so keys change and animations replay
    rotationCounterRef.current += 1;
  }, [rotatingPlaceholder]);

  // Focus input on initial mount
  useEffect(() => {
    inputRef.current?.focus();
    // Select any existing text (none on first load, but keeps UX consistent)
    inputRef.current?.select();
    // Start rotating placeholder text
    start();
  }, [start]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedText = query.trim();

    if (!trimmedText) {
      return;
    }

    // Begin search: results section will display when populated

    console.log("Search:", { query: trimmedText });

    // Simulate API call
    setIsSearching(true);

    // Simulate network delay
    setTimeout(() => {
      setResults(MOCK_RESULTS);
      setIsSearching(false);
    }, 800);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const form = event.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <>
      <div className="w-full max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={""}
            className="w-full bg-transparent text-foreground text-lg placeholder:text-muted-foreground border-b border-border focus:border-foreground outline-none transition-colors pb-3 pr-12"
            disabled={isSearching}
          />

          {/* Animated placeholder overlay (only when input is empty) */}
          {query.trim().length === 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-end pb-3 pr-12"
            >
              <div className="relative h-[1.75rem] overflow-hidden w-full text-muted-foreground text-2xl">
                {/* Previous text sliding out */}
                {prevPlaceholder && (
                  <span
                    key={`prev-${rotationCounterRef.current}`}
                    className="absolute inset-x-0 bottom-0 animate-lf-slide-up-out"
                  >
                    {prevPlaceholder}
                  </span>
                )}
                {/* Current text sliding in */}
                {rotatingPlaceholder && (
                  <span
                    key={`curr-${rotationCounterRef.current}`}
                    className="absolute inset-x-0 bottom-0 animate-lf-slide-up-in"
                  >
                    {rotatingPlaceholder}
                  </span>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={!query.trim() || isSearching}
            className="absolute right-0 bottom-1 rounded-full h-8 w-8 disabled:opacity-30"
          >
            <ArrowUp className="h-5 w-5" />
            <span className="sr-only">Submit</span>
          </Button>
        </form>
      </div>

      {isSearching && (
        <div className="w-full max-w-3xl mx-auto mt-12">
          <p className="text-sm text-muted-foreground">Searching...</p>
        </div>
      )}

      <SearchResults results={results} />
    </>
  );
}
