import { getQueryClient, trpc, HydrateClient } from "~/trpc/server";
import { notFound } from "next/navigation";
import type React from "react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { UserDropdownMenu } from "~/components/layouts/user-dropdown-menu";
import { ITEMS_PER_PAGE } from "~/components/sidebar/types";

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

	// Note: We don't prefetch sessions here because:
	// 1. prefetchInfiniteQuery can't be used in RSC (serialization issues)
	// 2. Regular prefetchQuery has different query keys than infiniteQuery
	// 3. We're using Suspense which handles the loading state gracefully

	return (
		<HydrateClient>
			<TooltipProvider>
				<SidebarProvider defaultOpen={true}>
					<div className="flex h-screen w-full">
						<AppSidebar />
						<div className="flex border-l border-muted/30 flex-col w-full relative">
							{/* Absolutely positioned header with user dropdown */}
							<header className="absolute top-0 right-0 z-10">
								<div className="flex items-center justify-end px-4 py-2">
									<UserDropdownMenu />
								</div>
							</header>
							{/* Content area starts from 0vh */}
							<div className="flex-1 min-h-0 overflow-hidden">{children}</div>
						</div>
					</div>
				</SidebarProvider>
			</TooltipProvider>
		</HydrateClient>
	);
}
