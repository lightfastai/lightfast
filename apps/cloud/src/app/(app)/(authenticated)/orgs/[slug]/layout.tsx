import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";

interface OrganizationLayoutProps {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}

export default async function OrganizationLayout({
	children,
	params,
}: OrganizationLayoutProps) {
	const { slug } = await params;

	const { userId, orgId, sessionClaims } = await auth();

	// Check if user is authenticated
	if (!userId) {
		redirect("/sign-in");
	}

	// Check for pending organization tasks
	if (sessionClaims?.currentTask) {
		console.log(`User ${userId} has pending task: ${String(sessionClaims.currentTask)}`);
		redirect("/select-organization");
	}

	// Check if user has organization membership for authenticated routes
	if (!orgId) {
		console.log(`User ${userId} attempting to access authenticated route without organization`);
		redirect("/select-organization");
	}

	console.log(`User ${userId} accessing org route '${slug}' with org ${orgId}`);

	return (
		<SidebarProvider>
			<AppSidebar organizationId={orgId} />
			<SidebarInset>
				<div className="flex flex-1 flex-col bg-muted/10 border border-border/30 rounded-lg">
					{children}
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}