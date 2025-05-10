import { useTimeAgo } from "@/hooks/use-time-ago";
import { Link } from "@tanstack/react-router";

import { RouterOutputs } from "@vendor/trpc";

interface PastSessionsProps {
  sessions?: RouterOutputs["tenant"]["session"]["list"];
}

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
        {sessions?.slice(0, 3).map((session) => (
          <Link
            className="text-muted-foreground hover:text-primary flex w-full items-center justify-between whitespace-nowrap"
            key={session.id}
            to="/$sessionId"
            params={{ sessionId: session.id }}
          >
            <div className="max-w-64 overflow-hidden [mask-image:linear-gradient(to_right,black_90%,transparent_100%)] font-mono text-xs whitespace-nowrap">
              {session.title.trim()}
            </div>
            <div className="font-mono text-xs">
              {useTimeAgo(session.updatedAt)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
