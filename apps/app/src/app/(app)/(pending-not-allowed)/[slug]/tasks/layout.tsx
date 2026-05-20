import { Suspense } from "react";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AuthenticatedTopbar
        left={
          <Suspense fallback={<TeamSwitcherSkeleton />}>
            <TeamSwitcher />
          </Suspense>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  );
}
