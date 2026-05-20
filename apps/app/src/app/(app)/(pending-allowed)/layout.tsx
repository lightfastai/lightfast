import { Suspense } from "react";
import { AuthenticatedTopbar } from "~/components/authenticated-topbar";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AuthenticatedTopbar
        left={
          <Suspense fallback={<TeamSwitcherSkeleton />}>
            <TeamSwitcher />
          </Suspense>
        }
      />
      <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  );
}
