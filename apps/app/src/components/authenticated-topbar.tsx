import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Suspense } from "react";
import { UserMenu, UserMenuSkeleton } from "~/components/user-menu";

interface AuthenticatedTopbarProps {
  left?: React.ReactNode;
}

export function AuthenticatedTopbar({ left }: AuthenticatedTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4">
      {left}
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
  );
}
