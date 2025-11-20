import { AccountSettingsSidebar } from "~/components/account-settings-sidebar";

export default function AccountSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full pb-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="py-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
        </div>

        <div className="flex gap-12">
          {/* Left Sidebar Navigation */}
          <AccountSettingsSidebar />

          {/* Main Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
