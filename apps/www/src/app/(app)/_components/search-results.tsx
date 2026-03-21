"use client";

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

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto mt-12 w-full max-w-3xl space-y-4">
      <h2 className="mb-6 text-muted-foreground text-xs">
        Related search results
      </h2>

      <div className="space-y-12">
        {results.map((result) => (
          <a
            className="group block"
            href={result.url}
            key={result.chunkId}
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="flex h-full items-center gap-8 py-2">
              {/* Placeholder thumbnail */}
              <div className="h-24 w-24 flex-shrink-0 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20" />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    {result.source}
                  </span>
                </div>

                <h3 className="mb-2 font-medium text-foreground text-sm transition-colors group-hover:text-primary">
                  {result.title}
                </h3>

                <p className="mb-2 line-clamp-2 text-foreground text-xs">
                  {result.highlight}
                </p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
