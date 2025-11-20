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
					<SettingsSidebar slug={slug} />

					{/* Main Content */}
					<div className="flex-1 min-w-0">{children}</div>
				</div>
			</div>
		</div>
	);
}
