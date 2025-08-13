import { trpc, HydrateClient, prefetch } from "~/trpc/server";
import type React from "react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";
import { TRPCReactProvider } from "~/trpc/react";

interface SessionLayoutProps {
	children: React.ReactNode;
	params: Promise<{
		sessionId: string;
	}>;
}

// Layout component for session pages - includes auth check and UI chrome
export default async function SessionLayout({
	children,
	params,
}: SessionLayoutProps) {
	// Await params to satisfy Next.js requirements
	await params;

	// Prefetch user data for instant loading
	prefetch(trpc.auth.user.getUser.queryOptions());
	
	// Prefetch pinned sessions for sidebar
	prefetch(trpc.chat.session.listPinned.queryOptions());

	return (
		<TRPCReactProvider>
			<HydrateClient>
				<TooltipProvider>
					<SidebarProvider defaultOpen={true}>
						<div className="flex h-screen w-full">
							<AppSidebar />
							<div className="flex border-l border-muted/30 flex-col w-full relative">
								<AuthenticatedHeader />
								{/* Content area starts from 0vh */}
								<div className="flex-1 min-h-0 overflow-hidden">{children}</div>
							</div>
						</div>
					</SidebarProvider>
				</TooltipProvider>
			</HydrateClient>
		</TRPCReactProvider>
	);
}

