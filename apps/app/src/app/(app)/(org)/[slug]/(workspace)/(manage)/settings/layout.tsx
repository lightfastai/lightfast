import { SettingsSidebar } from "~/components/settings-sidebar";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Access verification handled in parent [slug]/layout.tsx
  // Settings are accessible to all org members - no additional role check needed here

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-7xl px-6 pb-16 lg:px-8">
        {/* Header */}
        <div className="pb-8">
          <h1 className="font-medium font-pp text-3xl text-foreground tracking-tight">
            Settings
          </h1>
        </div>

        <div className="flex gap-12">
          {/* Left Sidebar Navigation */}
          <SettingsSidebar
            basePath={`/${slug}/settings`}
            items={[
              { name: "General", path: "" },
              { name: "API Keys", path: "api-keys" },
              { name: "Repo Index", path: "repo-index" },
            ]}
          />

          {/* Main Content */}
          <div className="min-w-0 max-w-4xl flex-1 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
