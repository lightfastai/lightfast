/**
 * Exa Search Visual Component
 *
 * Visual showcase for Exa-powered search capabilities.
 * Displays a code-like search query and mock search results.
 */

import Image from "next/image";

export function ExaSearchVisual() {
  const searchResults = [
    {
      title: "Authentication service architecture decision",
      domain: "github.com/lightfast/backend",
      timestamp: "3 days ago",
    },
    {
      title: "API rate limiting implementation - PR #842",
      domain: "github.com/lightfast/api",
      timestamp: "1 week ago",
    },
    {
      title: "User authentication flow diagram",
      domain: "notion.so/lightfast/docs",
      timestamp: "2 weeks ago",
    },
    {
      title: "Discussion: Choosing between Clerk vs Auth0",
      domain: "slack.com/lightfast/engineering",
      timestamp: "3 weeks ago",
    },
    {
      title: "Payment service dependencies and ownership",
      domain: "linear.app/lightfast/ENG-1234",
      timestamp: "1 month ago",
    },
    {
      title: "Authentication middleware refactor discussion",
      domain: "github.com/lightfast/backend/discussions",
      timestamp: "1 month ago",
    },
  ];

  return (
    <div className="h-full flex flex-col relative px-16 py-24">
      <div className="absolute inset-0 p-4">
        <div className="relative w-full h-full rounded-sm overflow-hidden">
          <Image
            src="/images/playground-placeholder-2.webp"
            alt="Background"
            fill
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 bg-background p-3 rounded-md h-full relative z-10">
        {/* Search Query Display */}
        <div className="bg-secondary rounded-md px-3 py-4 font-mono text-sm">
          <div className="text-muted-foreground">
            <span className="text-primary">lightfast</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-foreground">search</span>
            <span className="text-muted-foreground">(</span>
          </div>
          <div className="pl-4 text-foreground">
            "How does our authentication service work?"
          </div>
          <div className="text-muted-foreground">)</div>
        </div>

        {/* Search Results */}
        <div className="flex-1 bg-accent rounded-lg overflow-hidden">
          <div className="gap-2">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="px-3 py-2 hover:bg-accent transition-colors duration-150"
              >
                <div className="flex items-start gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="text-foreground font-medium text-sm mb-1">
                      {result.title}
                    </h3>

                    {/* Domain and Timestamp */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{result.domain}</span>
                      <span>|</span>
                      <span>{result.timestamp}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground underline text-xs ml-2"
                      >
                        Find similar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
