import { Search } from "lucide-react";
import { IntegrationIcons } from "@repo/ui/integration-icons";

const searchResults = [
  {
    title: "Database migration guide",
    source: "notion" as const,
  },
  {
    title: "PR #847: PostgreSQL support",
    source: "github" as const,
  },
  {
    title: "Database decision thread",
    source: "slack" as const,
  },
  {
    title: "Analytics service setup",
    source: "linear" as const,
  },
  {
    title: "PostgreSQL deployment docs",
    source: "notion" as const,
  },
];

export function SearchResultsPreview() {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Search Bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value="PostgreSQL analytics service"
          readOnly
          className="flex-1 bg-transparent text-sm text-foreground outline-none pointer-events-none"
        />
      </div>

      {/* Search Results - Grid matching integration-showcase exactly */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {searchResults.map((result) => {
            const Icon = IntegrationIcons[result.source];
            return (
              <div
                key={result.title}
                className="relative flex items-center justify-center"
              >
                <div className="bg-accent/40 border border-border/40 h-[6.25rem] px-3 flex w-full items-center justify-center rounded-xs">
                  <Icon
                    className="h-8 w-auto max-w-[120px] object-contain text-muted-foreground"
                    aria-label={`${result.source} logo`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results Count Footer */}
      <div className="px-3 py-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground">
          5 results from 3 sources
        </p>
      </div>
    </div>
  );
}
