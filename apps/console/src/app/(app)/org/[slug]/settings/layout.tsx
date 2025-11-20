import { notFound } from "next/navigation";
import { SettingsSidebar } from "~/components/settings-sidebar";
import { hasOrgRole } from "~/lib/org-access-clerk";

export default async function SettingsLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	// Admin-only settings: ensure the user has admin role in the active org
	// Parent org layout already verified membership and matched slug
	const isAdmin = await hasOrgRole("admin");
	if (!isAdmin) {
		notFound();
	}

	return (
		<div className="flex flex-1 flex-col h-full overflow-auto">
			<div className="flex flex-col gap-6 p-6">
				{/* Header */}
				<div>
					<h1 className="text-3xl font-semibold tracking-tight text-foreground">
						Settings
					</h1>
					<p className="mt-2 text-muted-foreground">
						Manage your workspace and connected sources
					</p>
				</div>

				<div className="flex gap-8">
					{/* Left Sidebar Navigation */}
					<SettingsSidebar slug={slug} />

					{/* Main Content */}
					<div className="flex-1 min-w-0">{children}</div>
				</div>
			</div>
		</div>
	);
}
