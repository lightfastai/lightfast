import { notFound } from "next/navigation";
import { WorkspaceSettingsSidebar } from "~/components/workspace-settings-sidebar";
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
		<div className="flex gap-12 pt-2 px-6 pb-6 w-full">
			{/* Left Sidebar Navigation - aligns with app sidebar */}
			<WorkspaceSettingsSidebar slug={slug} workspaceName={workspaceName} />

			{/* Main Content */}
			<div className="flex-1 min-w-0 max-w-4xl space-y-6">
				{children}
			</div>
		</div>
	);
}
