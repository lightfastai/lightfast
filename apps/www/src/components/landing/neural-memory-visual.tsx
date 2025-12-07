/**
 * Neural Memory Visual Component
 *
 * Showcases decision capture and observation extraction.
 * Displays timeline of key moments automatically extracted from sources.
 * Designed to be used inside VisualShowcase component.
 */

import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

const observations = [
  {
    title: "Chose Clerk over Auth0 for authentication",
    source: "GitHub Discussion #423",
    participants: ["@sarah", "@mike", "@alex"],
    timestamp: "3 days ago",
    context:
      "Evaluated Auth0, Clerk, and custom solution. Chose Clerk for better DX and pricing.",
  },
  {
    title: "Database connection pool exhaustion resolved",
    source: "Linear INC-892",
    participants: ["@mike", "@devops-team"],
    timestamp: "1 week ago",
    context:
      "Increased max connections from 20 to 50, added connection timeout monitoring.",
  },
  {
    title: "API rate limiting implementation merged",
    source: "PR #842",
    participants: ["@alex"],
    timestamp: "2 weeks ago",
    context:
      "Implemented Redis-based rate limiting with 100 req/min per user, 1000/min per org.",
  },
  {
    title: "Decided on PostgreSQL partition strategy",
    source: "Slack #engineering",
    participants: ["@sarah", "@mike", "@db-team"],
    timestamp: "3 weeks ago",
    context: "Monthly partitions for events table, quarterly for analytics.",
  },
  {
    title: "Payment provider: Stripe over Square",
    source: "Notion: Payment Integration RFC",
    participants: ["@product", "@eng", "@finance"],
    timestamp: "1 month ago",
    context:
      "Better international support and existing integration patterns in codebase.",
  },
];

export function NeuralMemoryVisual() {
  return (
    <div className="flex flex-col gap-3 bg-background p-3 rounded-md w-full max-w-2xl h-full overflow-hidden">
        {/* Header */}
        <div className="bg-secondary rounded-md px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                Memory Timeline
              </span>
              <span className="text-xs text-muted-foreground">
                Last 30 days
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-card"
              >
                Decisions
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* Observations Feed */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pr-3">
            {observations.map((obs, index) => (
              <div key={index} className="bg-secondary rounded-md p-3">
                <div className="flex items-start gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4 className="text-sm font-medium text-foreground mb-1">
                      {obs.title}
                    </h4>

                    {/* Context */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {obs.context}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="text-primary">{obs.source}</span>
                      </span>
                      <span>•</span>
                      <span>{obs.timestamp}</span>
                      {obs.participants.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {obs.participants.slice(0, 2).join(", ")}
                            {obs.participants.length > 2 && (
                              <span className="text-muted-foreground">
                                +{obs.participants.length - 2}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

      {/* Stats Footer */}
      <div className="bg-secondary rounded-md px-4 py-2 shrink-0">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">127</span>{" "}
            observations
          </span>
          <span>
            <span className="font-medium text-foreground">34</span> decisions
          </span>
          <span>
            <span className="font-medium text-foreground">8</span> incidents
          </span>
          <span>
            <span className="font-medium text-foreground">12</span> sources
          </span>
        </div>
      </div>
    </div>
  );
}
