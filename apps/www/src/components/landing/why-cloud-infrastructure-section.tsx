import React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { cloudUrl } from "~/lib/related-projects";

export function WhyCloudInfrastructureSection() {
  return (
    <div className="bg-background">
      <div className="space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
              <span>Why Agent Orchestration with Lightfast?</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Orchestration for startups looking to scale
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
                          Context fragmentation
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">✗</span>
                        <span className="text-foreground">
                          Engineering bottlenecks
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">✗</span>
                        <span className="text-foreground">
                          Manual workflows
                        </span>
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
                        CONTEXT
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
                        TEAM
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
                        WITH LIGHTFAST
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
                  Is context fragmentation slowing you down?
                </h3>
                <p className="text-muted-foreground">
                  Managing codebase + Linear + Notion + GitHub + Slack in one place.
                  Our platform provides deep context understanding across your entire stack,
                  preventing context degradation in multi-agent workflows.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">
                  Are you building integrations instead of product?
                </h3>
                <p className="text-muted-foreground">
                  Deep tool orchestration, not surface-level connections. We provide
                  semantic understanding of workflows with stateful context and
                  fine-grain control across your entire tool ecosystem.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">
                  Can your team self-serve answers?
                </h3>
                <p className="text-muted-foreground">
                  Non-technical teammates execute technical workflows without engineering
                  bottlenecks. Our orchestration layer enables multi-step workflows with
                  proper resource scheduling and error recovery.
                </p>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
