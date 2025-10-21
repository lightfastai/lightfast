import React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { cloudUrl } from "~/lib/related-projects";

export function WhyCloudInfrastructureSection() {
  return (
    <div className="bg-background py-20 sm:py-24 lg:pt-32 lg:pb-56 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        <div className="space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
              <span>Why Agent Orchestration?</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Multi-agent workflows are fundamentally complex
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* Left side - Visual representation */}
            <div className="space-y-6">
              <div className="rounded-lg border bg-card p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm bg-muted text-foreground px-3 py-1.5 rounded">
                    MANUAL ORCHESTRATION
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
                          Context pollution
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">✗</span>
                        <span className="text-foreground">
                          Agent coordination
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-500">✗</span>
                        <span className="text-foreground">
                          Workflow reliability
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500">!</span>
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
                        STATE
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
                        TOOLS
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded" />
                    <div className="h-2 bg-muted rounded w-3/4" />
                    <div className="h-2 bg-muted rounded w-1/2" />
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
                  Is context degradation killing your agents?
                </h3>
                <p className="text-muted-foreground">
                  Individual agents have limited context windows (1,
                  MaxToken_x]. Pollution degrades the token graph. Our platform
                  manages context construction across multi-agent hierarchies
                  without degradation.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">
                  Can your agents communicate effectively?
                </h3>
                <p className="text-muted-foreground">
                  Multi-agent coordination requires stateful context and
                  fine-grain control. We provide the orchestration layer for
                  subagent hierarchies to collaborate seamlessly.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">
                  How do you scale complex workflows?
                </h3>
                <p className="text-muted-foreground">
                  AI-native workflows need more than trigger-action chains. Our
                  state-machine engine orchestrates multi-step workflows with
                  proper resource scheduling and error recovery.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
