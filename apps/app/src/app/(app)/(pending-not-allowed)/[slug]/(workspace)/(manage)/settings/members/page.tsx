import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { OrgMemberInvite } from "./_components/org-member-invite";
import { OrgMemberList } from "./_components/org-member-list";
import { OrgMemberListLoading } from "./_components/org-member-list-loading";

export const dynamic = "force-dynamic";

export default function MembersPage() {
  prefetch(trpc.pendingNotAllowed.orgMembers.list.queryOptions());

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium font-pp text-2xl text-foreground">
            Members
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage teammates and pending invitations.
          </p>
        </div>
        <OrgMemberInvite />
      </div>

      <HydrateClient>
        <Suspense fallback={<OrgMemberListLoading />}>
          <OrgMemberList />
        </Suspense>
      </HydrateClient>
    </div>
  );
}
