import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Suspense } from "react";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";
import { UserMenu, UserMenuSkeleton } from "~/components/user-menu";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <Suspense fallback={<TeamSwitcherSkeleton />}>
          <TeamSwitcher />
        </Suspense>
        <div className="ml-auto flex items-center gap-3">
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
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  );
}
