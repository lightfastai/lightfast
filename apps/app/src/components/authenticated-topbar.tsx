import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Suspense } from "react";
import { UserMenu, UserMenuSkeleton } from "~/components/user-menu";

interface AuthenticatedTopbarProps {
  actions?: React.ReactNode;
  left?: React.ReactNode;
}

export function AuthenticatedTopbar({
  actions,
  left,
}: AuthenticatedTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4">
      {left}
      {/* Left region: route-specific actions (e.g. the signals views bar).
          min-w-0 + flex-1 lets a scrollable pill row grow without pushing the
          right cluster off-screen. */}
      <div className="flex min-w-0 flex-1 items-center">{actions}</div>
      <div className="flex shrink-0 items-center gap-3">
        {/* Non-essential nav links crowd the topbar on phones; hide < md so the
            route actions (views bar) keep room. UserMenu always stays. */}
        <div className="hidden items-center gap-3 md:flex">
          <MicrofrontendLink
            className="text-muted-foreground text-sm hover:text-foreground"
            href="/docs/get-started/overview"
            rel="noopener noreferrer"
            target="_blank"
          >
            Docs
          </MicrofrontendLink>
          <MicrofrontendLink
            className="text-muted-foreground text-sm hover:text-foreground"
            href="/docs/api-reference"
            rel="noopener noreferrer"
            target="_blank"
          >
            API Reference
          </MicrofrontendLink>
        </div>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
