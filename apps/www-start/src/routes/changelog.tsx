import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import ChangelogLayout from "~/app/(app)/(marketing)/(content)/changelog/layout";
import ChangelogPage from "~/app/(app)/(marketing)/(content)/changelog/page";
import { buildChangelogIndexHead } from "~/lib/changelog-content";

export const Route = createFileRoute("/changelog")({
  head: () => buildChangelogIndexHead(),
  component: ChangelogRoute,
});

function ChangelogRoute() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isIndexRoute = pathname === "/changelog" || pathname === "/changelog/";

  return (
    <MarketingLayout>
      <ChangelogLayout>
        {isIndexRoute ? <ChangelogPage /> : <Outlet />}
      </ChangelogLayout>
    </MarketingLayout>
  );
}
