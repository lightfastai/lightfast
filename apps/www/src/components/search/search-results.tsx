"use client";

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

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto mt-12 space-y-4">
      <h2 className="text-xs text-muted-foreground mb-6">
        Related search results
      </h2>

      <div className="space-y-12">
        {results.map((result) => (
          <a
            key={result.chunkId}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex items-center h-full py-2 gap-8">
              {/* Placeholder thumbnail */}
              <div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {result.source}
                  </span>
                </div>

                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-2">
                  {result.title}
                </h3>

                <p className="text-xs text-foreground line-clamp-2 mb-2">
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
