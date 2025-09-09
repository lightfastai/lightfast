import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { trpc, HydrateClient, prefetch } from "~/trpc/server";

interface OrganizationLayoutProps {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}

export default async function OrganizationLayout({
	children,
	params,
}: OrganizationLayoutProps) {
	const { slug } = await params;

	// Auth checks are handled by parent (authenticated) layout
	// This layout validates org access and handles org-specific UI
	const { userId, orgId, orgSlug } = await auth();

	// Validate that the slug in URL matches the user's current organization
	if (slug !== orgSlug) {
		console.log(
			`User ${userId} attempted to access org '${slug}' but belongs to org '${orgSlug}'`,
		);
		notFound();
	}

	console.log(`User ${userId} accessing org route '${slug}' with org ${orgId}`);

	// Prefetch user data for instant loading in AppSidebar
	prefetch(trpc.user.getUser.queryOptions());
	prefetch(trpc.user.getUserOrganizations.queryOptions());

	return (
		<>
			<SignedOut>
				<RedirectToTasks />
			</SignedOut>
			<HydrateClient>
				<SidebarProvider>
					<AppSidebar />
					<SidebarInset>
						<div className="flex flex-1 flex-col bg-muted/10 border border-border/30 rounded-lg overflow-hidden">
							{children}
						</div>
					</SidebarInset>
				</SidebarProvider>
			</HydrateClient>
		</>
	);
}

