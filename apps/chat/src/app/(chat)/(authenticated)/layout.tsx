import { getQueryClient, trpc, HydrateClient, prefetch } from "~/trpc/server";
import { notFound } from "next/navigation";
import type React from "react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";
import { TRPCReactProvider } from "~/trpc/react";

interface AuthenticatedLayoutProps {
	children: React.ReactNode;
}

// Server component layout - provides authentication check and chat UI
export default async function AuthenticatedLayout({
	children,
}: AuthenticatedLayoutProps) {
	const queryClient = getQueryClient();
	const session = await queryClient.fetchQuery(
		trpc.auth.user.getUser.queryOptions(),
	);

	if (!session.userId) {
		notFound();
	}

	// Prefetch pinned sessions for instant loading with Suspense
	// This will be available for all authenticated pages (new, [sessionId])
	prefetch(trpc.chat.session.listPinned.queryOptions());

	// Note: We don't prefetch infinite sessions here because:
	// 1. prefetchInfiniteQuery can't be used in RSC (serialization issues)
	// 2. Regular prefetchQuery has different query keys than infiniteQuery
	// 3. We're using Suspense which handles the loading state gracefully

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
