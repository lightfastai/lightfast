import { createFileRoute } from "@tanstack/react-router";
import { OrgMembersClient } from "~/org/settings/members/org-members-client";

export const Route = createFileRoute("/_authenticated/$slug/settings/members")({
  head: ({ params }) => ({
    meta: [
      { title: `Members - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage members and invitations for your Lightfast workspace.",
      },
    ],
  }),
  component: MembersSettingsPage,
});

function MembersSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Members
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage the people who can access this workspace.
        </p>
      </div>

      <OrgMembersClient />
    </div>
  );
}
