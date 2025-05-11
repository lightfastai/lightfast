import React from "react";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { RouterOutputs } from "@vendor/trpc";

import type { DBSession } from "../types/internal";

interface PastSessionsProps {
  sessions: RouterOutputs["tenant"]["session"]["list"];
}

interface PastSessionLinkProps {
  sessionId: string;
  children: (session: DBSession | undefined) => React.ReactNode;
  className?: string;
}

export const PastSessionLink: React.FC<PastSessionLinkProps> = ({
  sessionId,
  children,
  className,
}) => {
  const { data: session } = useQuery(
    trpc.tenant.session.get.queryOptions({ sessionId }),
  );
  return (
    <Link className={className} to="/$sessionId" params={{ sessionId }}>
      {children(session)}
    </Link>
  );
};

export const PastSessions: React.FC<PastSessionsProps> = ({ sessions }) => {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="text-muted-foreground/70 font-mono text-[0.65rem]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-muted-foreground/70 font-mono text-xs">
            Past Sessions
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {sessions.slice(0, 3).map((session) => (
          <PastSessionLink
            key={session.id}
            sessionId={session.id}
            className="text-muted-foreground hover:text-primary flex w-full items-center justify-between whitespace-nowrap"
          >
            {(fullSession) =>
              fullSession ? (
                <>
                  <div className="max-w-64 overflow-hidden text-xs whitespace-nowrap">
                    {fullSession.title.trim()}
                  </div>
                  <div className="text-xs">
                    {useTimeAgo(fullSession.updatedAt)}
                  </div>
                </>
              ) : (
                <div className="text-xs italic opacity-60">Loading...</div>
              )
            }
          </PastSessionLink>
        ))}
      </div>
    </div>
  );
};
