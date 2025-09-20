import { Suspense } from "react";
import { cookies } from "next/headers";
import { trpc, HydrateClient, prefetch } from "~/trpc/server";
import type React from "react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { AuthenticatedHeader } from "~/components/layouts/authenticated-header";
import { CloseTemporaryButton } from "~/components/layouts/close-temporary-button";
import { TemporaryModeWrapper } from "~/components/layouts/temporary-mode-wrapper";
import { TRPCReactProvider } from "~/trpc/react";
import { ChatLoadingSkeleton } from "./_components/chat-loading-skeleton";
import { KeyboardShortcuts } from "~/components/keyboard-shortcuts";

interface AuthenticatedLayoutProps {
	children: React.ReactNode;
}

// Shared layout for all authenticated pages (new, [sessionId])
export default async function AuthenticatedLayout({
	children,
}: AuthenticatedLayoutProps) {
	// Prefetch user data for instant loading
	prefetch(trpc.user.getUser.queryOptions());

	// Prefetch usage limits for billing context
	prefetch(trpc.usage.checkLimits.queryOptions({}));

	// Prefetch pinned sessions for sidebar
	prefetch(trpc.session.listPinned.queryOptions());

	// Get sidebar state from cookies
	const cookieStore = await cookies();
	const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

	// Note: We don't prefetch infinite sessions here because:
	// 1. prefetchInfiniteQuery can't be used in RSC (serialization issues)
	// 2. Regular prefetchQuery has different query keys than infiniteQuery
	// 3. We're using Suspense which handles the loading state gracefully

	return (
		<TRPCReactProvider>
			<HydrateClient>
				<TooltipProvider>
					<SidebarProvider defaultOpen={!isCollapsed}>
						<KeyboardShortcuts />
						<TemporaryModeWrapper>
							<div className="hidden group-data-[temp=true]:block absolute top-2 left-3 text-[12px] leading-4 font-semibold text-slate-900">
								Temporary Chat
							</div>
							<CloseTemporaryButton className="hidden group-data-[temp=true]:inline-flex absolute top-2 right-3 h-7 w-7 items-center justify-center rounded-md text-slate-900 hover:bg-slate-900/5" />

							<div className="group-data-[temp=true]:hidden">
								<AppSidebar />
							</div>

							<div className="flex border-l border-muted/30 flex-col flex-1 min-w-0 relative group-data-[temp=true]:rounded-xl group-data-[temp=true]:border group-data-[temp=true]:border-border/30 group-data-[temp=true]:overflow-hidden">
								<div className="group-data-[temp=true]:hidden">
									<AuthenticatedHeader />
								</div>
								{/* Content area starts from 0vh */}
								<div className="flex-1 min-h-0 overflow-hidden">
									<Suspense fallback={<ChatLoadingSkeleton />}>
										{children}
									</Suspense>
								</div>
							</div>
						</TemporaryModeWrapper>
					</SidebarProvider>
				</TooltipProvider>
			</HydrateClient>
		</TRPCReactProvider>
	);
}
