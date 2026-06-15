import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SettingsSidebar } from "~/components/settings-sidebar";

export const Route = createFileRoute("/_authenticated/account/settings")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/account/settings") {
      throw redirect({
        search: location.search,
        to: "/account/settings/general",
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Account Settings - Lightfast" },
      {
        name: "description",
        content: "Manage your Lightfast account settings.",
      },
    ],
  }),
  component: AccountSettingsLayout,
});

function AccountSettingsLayout() {
  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-7xl pr-6 pb-16 pl-3 lg:px-8">
        <div className="pt-2 pb-8">
          <h1 className="pl-3 font-medium font-pp text-3xl text-foreground tracking-tight">
            Your Account
          </h1>
        </div>

        <div className="flex gap-12">
          <SettingsSidebar
            items={[
              { name: "General", to: "/account/settings/general" },
              {
                name: "Source Control & Git",
                to: "/account/settings/source-control",
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
