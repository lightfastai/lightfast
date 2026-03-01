import { SettingsSidebar } from "~/components/settings-sidebar";

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 pb-16">
        {/* Header */}
        <div className="py-8">
          <h1 className="text-3xl font-pp font-medium tracking-tight text-foreground">
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
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
