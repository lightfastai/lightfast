import React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { cloudUrl } from "~/lib/related-projects";

export function WhyCloudInfrastructureSection() {
  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
          <span>The Problem</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
          Your team's memory, organized
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
        {/* Left side - Visual representation */}
        <div className="space-y-6">
          {/* Without Lightfast Card */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="font-mono text-sm bg-red-500/10 text-red-500 px-3 py-1.5 rounded">
                WITHOUT LIGHTFAST
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  CHALLENGES
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-foreground">
                      Lost context
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-foreground">
                      Knowledge scattered
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    <span className="text-foreground">Hunting for answers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Visual bars */}
          <div className="rounded-lg border bg-card p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-red-500">✗</span>
                  <span className="text-xs font-mono text-foreground">
                    SCATTERED
                  </span>
                </div>
                <div className="h-2 bg-muted rounded" />
                <div className="h-2 bg-red-500/20 rounded w-4/5" />
                <div className="h-2 bg-muted rounded w-3/5" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-red-500">✗</span>
                  <span className="text-xs font-mono text-foreground">
                    LOST
                  </span>
                </div>
                <div className="h-2 bg-muted rounded" />
                <div className="h-2 bg-red-500/20 rounded w-5/6" />
                <div className="h-2 bg-red-500/20 rounded w-2/3" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-xs font-mono text-foreground">
                    ORGANIZED
                  </span>
                </div>
                <div className="h-2 bg-green-500/40 rounded" />
                <div className="h-2 bg-green-500/40 rounded w-3/4" />
                <div className="h-2 bg-green-500/40 rounded w-1/2" />
              </div>
            </div>
          </div>

          <Link href={cloudUrl}>
            <Button
              variant="outline"
              size="sm"
              className="w-fit text-foreground"
            >
              Join our waitlist →
            </Button>
          </Link>
        </div>

        {/* Right side - Questions and explanations */}
        <div className="space-y-8">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-foreground">
              Losing context across tools?
            </h3>
            <p className="text-muted-foreground">
              Decisions in Slack. Context in Linear. Code in GitHub. When
              someone asks "why did we do this?" the answer is scattered across
              your entire stack. Lightfast unifies everything so you can search
              by meaning and find what you need instantly.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-foreground">
              Searching instead of building?
            </h3>
            <p className="text-muted-foreground">
              Your team spends hours hunting for information instead of shipping
              product. Every answer should cite its source. Every search should
              understand intent. Stop wasting time—make knowledge instantly
              accessible.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-foreground">
              Can anyone find what they need?
            </h3>
            <p className="text-muted-foreground">
              New teammates shouldn't need to ask 10 people to find context.
              Agents shouldn't fail because they can't access knowledge.
              Lightfast makes your team's memory searchable for everyone—people
              and AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
