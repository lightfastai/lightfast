/// <reference types="vite/client" />
import {
	HeadContent,
	Scripts,
	createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/default-catch-boundary";
import { NotFound } from "~/components/not-found";
import { AppSidebar } from "~/components/app-sidebar";
import { fonts } from "~/lib/fonts";
import appCss from "~/styles/globals.css?url";
import { seo } from "~/utils/seo";
import { SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			...seo({
				title: "Lightfast CLI | Agent Management",
				description: `Manage and monitor your Lightfast AI agents`,
			}),
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png",
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png",
			},
			{ rel: "manifest", href: "/site.webmanifest", color: "#fffff" },
			{ rel: "icon", href: "/favicon.ico" },
		],
	}),
	errorComponent: DefaultCatchBoundary,
	notFoundComponent: () => <NotFound />,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html className="dark">
			<head>
				<HeadContent />
			</head>
			<body className={`bg-background min-h-screen ${fonts}`}>
				<TooltipProvider>
					<SidebarProvider defaultOpen={true}>
						<div className="flex h-screen w-full">
							<AppSidebar />
							<div className="flex border-l border-muted/30 flex-col w-full relative">
								{/* Content area */}
								<div className="flex-1 min-h-0 overflow-hidden">
									<main className="h-full overflow-auto">
										<div className="container mx-auto p-6">
											{children}
										</div>
									</main>
								</div>
							</div>
						</div>
					</SidebarProvider>
				</TooltipProvider>
				<TanStackRouterDevtools position="bottom-right" />
				<Scripts />
			</body>
		</html>
	);
}
