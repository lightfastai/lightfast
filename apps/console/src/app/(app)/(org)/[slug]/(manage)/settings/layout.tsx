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
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-7xl px-6 lg:px-8 pb-16">
        {/* Header */}
        <div className="pb-8">
          <h1 className="text-3xl font-pp font-medium tracking-tight text-foreground">
            Settings
          </h1>
        </div>

        <div className="flex gap-12">
          {/* Left Sidebar Navigation */}
          <SettingsSidebar
            basePath={`/${slug}/settings`}
            items={[
              { name: "General", path: "" },
              { name: "Sources", path: "sources" },
              { name: "API Keys", path: "api-keys" },
            ]}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0 max-w-4xl space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
