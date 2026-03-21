"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ArrowUp } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTextCycle } from "../_hooks/use-text-cycle";
import { SearchResults } from "./search-results";

interface SearchResult {
  author: string;
  chunkId: string;
  documentId: string;
  highlight: string;
  occurredAt: string;
  score: number;
  sectionLabel?: string;
  source: string;
  title: string;
  type: string;
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
    }
  );

  // Track previous placeholder to animate it out
  const [placeholderAnim, setPlaceholderAnim] = useState<{
    prev: string | undefined;
    counter: number;
  }>({ prev: undefined, counter: 0 });
  const lastShownRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (rotatingPlaceholder === undefined) {
      return;
    }

    const prev = lastShownRef.current;
    lastShownRef.current = rotatingPlaceholder;
    setPlaceholderAnim((a) => ({ prev, counter: a.counter + 1 }));
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
      <div className="mx-auto w-full max-w-3xl">
        <form className="relative" onSubmit={handleSubmit}>
          <input
            className="w-full border-border border-b bg-transparent pr-12 pb-3 text-foreground text-lg outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            disabled={isSearching}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={""}
            ref={inputRef}
            type="text"
            value={query}
          />

          {/* Animated placeholder overlay (only when input is empty) */}
          {query.trim().length === 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-end pr-12 pb-3"
            >
              <div className="relative h-[1.75rem] w-full overflow-hidden text-2xl text-muted-foreground">
                {/* Previous text sliding out */}
                {placeholderAnim.prev && (
                  <span
                    className="absolute inset-x-0 bottom-0 animate-lf-slide-up-out"
                    key={`prev-${placeholderAnim.counter}`}
                  >
                    {placeholderAnim.prev}
                  </span>
                )}
                {/* Current text sliding in */}
                {rotatingPlaceholder && (
                  <span
                    className="absolute inset-x-0 bottom-0 animate-lf-slide-up-in"
                    key={`curr-${placeholderAnim.counter}`}
                  >
                    {rotatingPlaceholder}
                  </span>
                )}
              </div>
            </div>
          )}

          <Button
            className="absolute right-0 bottom-1 h-8 w-8 rounded-full disabled:opacity-30"
            disabled={!query.trim() || isSearching}
            size="icon"
            type="submit"
            variant="ghost"
          >
            <ArrowUp className="h-5 w-5" />
            <span className="sr-only">Submit</span>
          </Button>
        </form>
      </div>

      {isSearching && (
        <div className="mx-auto mt-12 w-full max-w-3xl">
          <p className="text-muted-foreground text-sm">Searching...</p>
        </div>
      )}

      <SearchResults results={results} />
    </>
  );
}
