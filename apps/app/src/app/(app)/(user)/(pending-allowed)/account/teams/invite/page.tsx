import { Icons } from "@repo/ui/components/icons";
import { redirect } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { ErrorBanner } from "../_components/error-banner";
import { InviteForm } from "./_components/invite-form";
import { loadInviteSearchParams } from "./_lib/search-params";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function InviteTeammatesPage({ searchParams }: PageProps) {
  const { teamSlug, error } = await loadInviteSearchParams(searchParams);

  if (!teamSlug) {
    redirect("/account/teams/new");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <div className="pb-4">
            <h1 className="font-medium font-pp text-2xl text-foreground">
              Invite your teammates
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Get your team started on {teamSlug}
            </p>
          </div>

          {error && (
            <ErrorBanner
              backUrl={`/account/teams/invite?teamSlug=${teamSlug}`}
              message={error}
            />
          )}

          <InviteForm teamSlug={teamSlug} />
        </div>
      </div>
    </div>
  );
}
