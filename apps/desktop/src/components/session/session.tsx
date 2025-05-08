import React from "react";
import { PastSessions } from "@/components/past-sessions";
import { BlenderStatusIndicator } from "@/components/status-indicator";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { ChevronUpIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

import { SessionOrchestrator } from "./session-orchestrator";

export interface SessionProps {
  sessionId: string;
}

export const Session: React.FC<SessionProps> = ({ sessionId }) => {
  const { data: session } = useQuery(
    trpc.tenant.session.get.queryOptions({ sessionId }),
  );
  const { data: sessions } = useQuery(trpc.tenant.session.list.queryOptions());
  const [showPastSessions, setShowPastSessions] = React.useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 pt-16 pb-4">
      <header className="flex w-full items-center justify-between">
        <h1
          className={cn(
            "text-muted-foreground bg-muted-foreground/10 h-5 min-w-20 rounded-md border px-3 py-1 font-mono text-[0.65rem] font-bold",
          )}
        >
          {session?.title}
        </h1>
        <BlenderStatusIndicator />
      </header>
      <main className="flex w-full flex-1 flex-col gap-2">
        <div className="relative flex h-full w-full flex-col items-end justify-between">
          <SessionOrchestrator sessionId={sessionId} />
          {session?.messages == null ? (
            <PastSessions sessions={sessions} />
          ) : (
            <button
              type="button"
              aria-label={
                showPastSessions ? "Hide past sessions" : "Show past sessions"
              }
              className="bg-muted text-muted-foreground hover:bg-muted/70 flex items-center justify-center rounded-md border px-2 py-1 transition"
              onClick={() => setShowPastSessions((v) => !v)}
            >
              <ChevronUpIcon
                className={cn(
                  "size-4 transition-transform",
                  showPastSessions ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
          )}
          {showPastSessions && session?.messages != null && (
            <PastSessions sessions={sessions} />
          )}
        </div>
        {/* Optional: Tool panel (e.g., BlenderMCP) */}
        {/* <BlenderMCP /> */}
      </main>
    </div>
  );
};
