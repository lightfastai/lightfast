import { getQueryClient, trpc } from "~/trpc/server";
import { notFound } from "next/navigation";
import type React from "react";
import { Suspense } from "react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { UserDropdownMenu } from "~/components/layouts/user-dropdown-menu";

interface AuthenticatedLayoutProps {
	children: React.ReactNode;
}

// Server component layout - provides authentication check and chat UI
export default async function AuthenticatedLayout({
	children,
}: AuthenticatedLayoutProps) {
	const queryClient = getQueryClient();
	const session = await queryClient.fetchQuery(
		trpc.auth.session.getSession.queryOptions(),
	);

	if (!session.userId) {
		notFound();
	}

	return (
		<TooltipProvider>
			<TRPCReactProvider>
				<SidebarProvider defaultOpen={true}>
					<div className="flex h-screen w-full">
						<Suspense fallback={<div className="w-64 bg-muted/30 animate-pulse" />}>
							<AppSidebar />
						</Suspense>
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
			</TRPCReactProvider>
		</TooltipProvider>
	);
}

