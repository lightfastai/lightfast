/**
 * Semantic Search Visual Component
 *
 * Demonstrates semantic search capability - searching by meaning, not keywords.
 * Shows a search query with results ranked by relevance.
 */

import { Search } from "lucide-react";

const searchResults = [
  {
    title: "Authentication migration to Clerk",
    source: "PR #842",
    snippet:
      "Migrated from Auth0 to Clerk for better developer experience and lower costs. Includes session management updates.",
    relevance: 0.94,
    highlight: "authentication",
  },
  {
    title: "User session handling in API routes",
    source: "docs/authentication.md",
    snippet:
      "All API routes require valid session tokens. Sessions expire after 24 hours of inactivity.",
    relevance: 0.89,
    highlight: "session",
  },
  {
    title: "Login flow implementation",
    source: "GitHub Discussion #156",
    snippet:
      "Decided on redirect-based login instead of modal to support SSO providers.",
    relevance: 0.85,
    highlight: "login",
  },
  {
    title: "JWT token validation middleware",
    source: "src/middleware/auth.ts",
    snippet:
      "Validates JWT tokens on every request. Handles refresh token rotation automatically.",
    relevance: 0.82,
    highlight: "token validation",
  },
];

export function SemanticSearchVisual() {
  return (
    <div className="flex flex-col gap-3 bg-background p-3 rounded-md w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div className="bg-secondary rounded-md px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            How does authentication work?
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 space-y-3">
        {searchResults.map((result, index) => (
          <div key={index} className="bg-secondary rounded-md p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-foreground">
                    {result.title}
                  </h4>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {Math.round(result.relevance * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {result.snippet}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-primary">{result.source}</span>
                  <span>•</span>
                  <span>matched: "{result.highlight}"</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Footer */}
      <div className="bg-secondary rounded-md px-4 py-2 shrink-0">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">4</span> results
          </span>
          <span>
            <span className="font-medium text-foreground">semantic</span> search
          </span>
          <span>
            <span className="font-medium text-foreground">23ms</span> response
          </span>
        </div>
      </div>
    </div>
  );
}
