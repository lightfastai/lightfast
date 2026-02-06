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
    <div className="flex gap-12 pt-2 px-6 pb-6 w-full">
      {/* Left Sidebar Navigation - aligns with app sidebar */}
      <SettingsSidebar slug={slug} />

      {/* Main Content */}
      <div className="flex-1 min-w-0 max-w-4xl space-y-6">{children}</div>
    </div>
  );
}
