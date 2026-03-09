import { notFound } from "next/navigation";
import { SettingsSidebar } from "~/components/settings-sidebar";
import { hasOrgRole } from "~/lib/org-access-clerk";

export default async function WorkspaceSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  const { slug, workspaceName } = await params;

  // Admin-only workspace settings: ensure the user has admin role in the active org
  // Parent org layout already verified membership and matched slug
  const isAdmin = await hasOrgRole("admin");
  if (!isAdmin) {
    notFound();
  }

  return (
    <div className="flex w-full gap-12 px-6 pt-2 pb-6">
      {/* Left Sidebar Navigation - aligns with app sidebar */}
      <SettingsSidebar
        basePath={`/${slug}/${workspaceName}/settings`}
        items={[{ name: "General", path: "" }]}
      />

      {/* Main Content */}
      <div className="min-w-0 max-w-4xl flex-1 space-y-6">{children}</div>
    </div>
  );
}
