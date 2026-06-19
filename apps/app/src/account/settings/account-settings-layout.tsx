import { Outlet } from "@tanstack/react-router";
import { SettingsSidebar } from "~/components/settings-sidebar";
import { TeamSwitcherSlot } from "~/components/team-switcher";

export function AccountSettingsLayout() {
  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-7xl pr-6 pb-16 pl-3 lg:px-8">
        <div className="pt-2 pb-8">
          <div className="mb-6 pl-3">
            <TeamSwitcherSlot />
          </div>
          <h1 className="pl-3 font-medium font-title text-3xl text-foreground tracking-tight">
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
