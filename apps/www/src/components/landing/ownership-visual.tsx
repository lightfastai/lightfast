/**
 * Ownership Visual Component
 *
 * Demonstrates ownership tracking - who owns what, who has context.
 * Shows people/teams mapped to codebases, features, and areas of expertise.
 */

import { User, Users, Code, FileText } from "lucide-react";

const ownershipData = [
  {
    person: "@sarah",
    role: "Tech Lead",
    owns: [
      { type: "codebase", name: "authentication", icon: Code },
      { type: "codebase", name: "billing", icon: Code },
    ],
    recentContext: "Led Clerk migration, owns payment integrations",
  },
  {
    person: "@mike",
    role: "Senior Engineer",
    owns: [
      { type: "codebase", name: "database", icon: Code },
      { type: "area", name: "infrastructure", icon: FileText },
    ],
    recentContext: "Fixed connection pool issues, manages DB schema",
  },
  {
    person: "@alex",
    role: "Engineer",
    owns: [
      { type: "codebase", name: "api-gateway", icon: Code },
      { type: "area", name: "rate-limiting", icon: FileText },
    ],
    recentContext: "Implemented Redis rate limiting, API security",
  },
  {
    person: "@devops-team",
    role: "Team",
    owns: [
      { type: "area", name: "deployments", icon: FileText },
      { type: "area", name: "monitoring", icon: FileText },
    ],
    recentContext: "Manages CI/CD, alerting, and incident response",
  },
];

export function OwnershipVisual() {
  return (
    <div className="flex flex-col gap-3 bg-background p-3 rounded-md w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-secondary rounded-md px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              Ownership Map
            </span>
            <span className="text-xs text-muted-foreground">
              Who owns what
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-card"
            >
              People
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            >
              Areas
            </button>
          </div>
        </div>
      </div>

      {/* Ownership List */}
      <div className="flex-1 space-y-3">
        {ownershipData.map((item, index) => (
          <div key={index} className="bg-secondary rounded-md p-3">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
                {item.role === "Team" ? (
                  <Users className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {item.person}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.role}
                  </span>
                </div>

                {/* Ownership tags */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {item.owns.map((ownership, idx) => {
                    const Icon = ownership.icon;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-card text-muted-foreground"
                      >
                        <Icon className="w-3 h-3" />
                        {ownership.name}
                      </span>
                    );
                  })}
                </div>

                {/* Context */}
                <p className="text-xs text-muted-foreground">
                  {item.recentContext}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Footer */}
      <div className="bg-secondary rounded-md px-4 py-2 shrink-0">
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">12</span> people
          </span>
          <span>
            <span className="font-medium text-foreground">3</span> teams
          </span>
          <span>
            <span className="font-medium text-foreground">24</span> areas tracked
          </span>
        </div>
      </div>
    </div>
  );
}
