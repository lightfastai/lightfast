import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SettingsSidebar } from "~/components/settings-sidebar";

export const Route = createFileRoute("/_authenticated/$slug/settings")({
  beforeLoad: ({ location, params }) => {
    if (location.pathname === `/${params.slug}/settings`) {
      throw redirect({
        params: { slug: params.slug },
        to: "/$slug/settings/general",
      });
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Settings - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage your Lightfast workspace settings.",
      },
    ],
  }),
  component: WorkspaceSettingsLayout,
});

function WorkspaceSettingsLayout() {
  const { slug } = Route.useParams();

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-7xl pr-6 pb-16 pl-3 lg:px-8">
        <div className="pt-2 pb-8">
          <h1 className="pl-3 font-medium font-pp text-3xl text-foreground tracking-tight">
            Settings
          </h1>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <SettingsSidebar
            items={[
              {
                activePath: `/${slug}/settings/general`,
                name: "General",
                params: { slug },
                to: "/$slug/settings/general",
              },
              {
                activePath: `/${slug}/settings/source-control`,
                name: "Source Control & Git",
                params: { slug },
                to: "/$slug/settings/source-control",
              },
              {
                activePath: `/${slug}/settings/members`,
                name: "Members",
                params: { slug },
                to: "/$slug/settings/members",
              },
              {
                activePath: `/${slug}/settings/billing`,
                name: "Billing",
                params: { slug },
                to: "/$slug/settings/billing",
              },
              {
                activePath: `/${slug}/settings/api-keys`,
                name: "API Keys",
                params: { slug },
                to: "/$slug/settings/api-keys",
              },
              {
                activePath: `/${slug}/settings/mcp`,
                name: "MCP",
                params: { slug },
                to: "/$slug/settings/mcp",
              },
            ]}
          />

          <div className="min-w-0 max-w-4xl flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
