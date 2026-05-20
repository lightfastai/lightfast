import { Button } from "@repo/ui/components/ui/button";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";

export default function AppNotFound() {
  return (
    <div className="flex min-h-full w-full flex-col overflow-hidden bg-background">
      <AuthenticatedTopbar
        left={
          <Suspense fallback={<TeamSwitcherSkeleton />}>
            <TeamSwitcher />
          </Suspense>
        }
      />
      <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        <div className="flex min-h-full w-full items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl rounded-sm border border-border border-dashed p-10 text-center sm:p-16">
            <div className="mb-8 flex justify-center">
              <div className="relative h-20 w-20">
                <div className="h-20 w-20 rounded-full border-2 border-border" />
                <div className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
              </div>
            </div>

            <h1 className="mb-5 font-bold text-7xl text-foreground">404</h1>
            <p className="mx-auto mb-8 max-w-sm text-muted-foreground text-sm">
              Sorry, we couldn't find the page you're looking for.
            </p>

            <Button
              asChild
              className="rounded-full"
              size="lg"
              variant="outline"
            >
              <Link href={"/" as Route}>Return Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
