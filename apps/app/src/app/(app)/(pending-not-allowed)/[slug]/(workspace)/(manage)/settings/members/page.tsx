import { getQueryClient, HydrateClient, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { OrgMemberListLoading } from "./_components/org-member-list-loading";
import { OrgMembersClient } from "./_components/org-members-client";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  await getQueryClient().fetchQuery(
    trpc.org.settings.orgMembers.list.queryOptions()
  );

  return (
    <HydrateClient>
      <div className="space-y-8">
        <div>
          <h2 className="font-medium font-pp text-2xl text-foreground">
            Members
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage teammates and pending invitations.
          </p>
        </div>

        <Suspense fallback={<OrgMemberListLoading />}>
          <OrgMembersClient />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
