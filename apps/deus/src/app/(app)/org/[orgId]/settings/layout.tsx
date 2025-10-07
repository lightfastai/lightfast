import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SettingsSidebar } from "~/components/settings-sidebar";
import { verifyOrgAccess } from "~/lib/org-access";

export default async function SettingsLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ orgId: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/sign-in");
	}

	const { orgId } = await params;
	const githubOrgId = parseInt(orgId, 10);

	if (isNaN(githubOrgId)) {
		notFound();
	}

	// Verify user has access to this organization
	const access = await verifyOrgAccess(userId, githubOrgId);

	if (!access.hasAccess) {
		if (access.reason === "org_not_found") {
			notFound();
		}
		redirect("/onboarding");
	}

	return (
		<div className="pt-14 lg:pt-20 px-6 pb-16">
				{/* Header */}
				<div className="mb-8 pt-6">
					<h1 className="text-3xl font-semibold tracking-tight text-foreground">
						Settings
					</h1>
					<p className="mt-2 text-muted-foreground">
						Manage your account and repository connections
					</p>
				</div>

				<div className="flex gap-8">
					{/* Left Sidebar Navigation */}
					<SettingsSidebar orgId={orgId} />

					{/* Main Content */}
					<div className="flex-1 min-w-0">{children}</div>
				</div>
			</div>
	);
}
