import { SettingsSidebar } from "~/components/settings-sidebar";

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-7xl pl-3 pr-6 pb-16 lg:px-8">
        {/* Header */}
        <div className="pt-2 pb-8">
          <h1 className="pl-3 font-medium font-pp text-3xl text-foreground tracking-tight">
            Your Account
          </h1>
        </div>

        <div className="flex gap-12">
          {/* Left Sidebar Navigation */}
          <SettingsSidebar
            basePath="/account/settings"
            items={[{ name: "General", path: "general" }]}
          />

          {/* Main Content */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
