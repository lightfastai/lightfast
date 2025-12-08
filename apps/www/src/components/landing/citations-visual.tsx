/**
 * Citations Visual Component
 *
 * Demonstrates citation capability - every answer shows its source.
 * Shows a synthesized answer with inline citations that link to sources.
 */

import { Quote, ExternalLink } from "lucide-react";

const answerWithCitations = {
  question: "Why did we choose Clerk over Auth0?",
  answer: [
    { type: "text", content: "The team chose Clerk over Auth0 for three main reasons: " },
    { type: "text", content: "better developer experience with simpler SDK integration" },
    { type: "citation", id: 1 },
    { type: "text", content: ", more competitive pricing for our expected user volume" },
    { type: "citation", id: 2 },
    { type: "text", content: ", and built-in support for the authentication patterns we needed" },
    { type: "citation", id: 3 },
    { type: "text", content: ". The migration was completed in Q3 with minimal disruption to existing users." },
    { type: "citation", id: 4 },
  ],
  sources: [
    {
      id: 1,
      title: "Auth provider evaluation",
      source: "GitHub Discussion #423",
      excerpt: "Clerk's React hooks are much cleaner than Auth0's SDK...",
    },
    {
      id: 2,
      title: "Cost analysis: Auth providers",
      source: "Notion: Engineering RFCs",
      excerpt: "At 10k MAU, Clerk saves us ~$200/month vs Auth0...",
    },
    {
      id: 3,
      title: "SSO requirements review",
      source: "Linear ENG-234",
      excerpt: "Clerk supports SAML and OIDC out of the box...",
    },
    {
      id: 4,
      title: "Clerk migration complete",
      source: "PR #842",
      excerpt: "All users migrated, sessions preserved, zero downtime...",
    },
  ],
};

export function CitationsVisual() {
  return (
    <div className="flex flex-col gap-3 bg-background p-3 rounded-md w-full max-w-2xl mx-auto">
      {/* Question */}
      <div className="bg-secondary rounded-md px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Quote className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">
            {answerWithCitations.question}
          </span>
        </div>
      </div>

      {/* Answer and Sources */}
      <div className="flex-1 space-y-3">
        {/* Answer with inline citations */}
        <div className="bg-secondary rounded-md p-4">
          <p className="text-sm text-foreground leading-relaxed">
            {answerWithCitations.answer.map((part, index) => {
              if (part.type === "citation") {
                return (
                  <sup
                    key={index}
                    className="inline-flex items-center justify-center w-4 h-4 ml-0.5 text-[10px] font-medium rounded bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                  >
                    {part.id}
                  </sup>
                );
              }
              return <span key={index}>{part.content}</span>;
            })}
          </p>
        </div>

        {/* Sources */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground px-1">
            Sources
          </span>
          <div className="grid grid-cols-2 gap-2">
            {answerWithCitations.sources.map((source) => (
              <div
                key={source.id}
                className="bg-secondary rounded-md p-3 hover:bg-secondary/80 cursor-pointer group"
              >
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium rounded bg-primary/20 text-primary shrink-0 mt-0.5">
                    {source.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium text-foreground truncate">
                        {source.title}
                      </span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-xs text-primary">{source.source}</span>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {source.excerpt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="bg-secondary rounded-md px-4 py-2 shrink-0">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">4</span> citations
          </span>
          <span>
            <span className="font-medium text-foreground">3</span> sources types
          </span>
          <span>
            <span className="font-medium text-foreground">verified</span> answer
          </span>
        </div>
      </div>
    </div>
  );
}
