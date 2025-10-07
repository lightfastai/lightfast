"use client";

import * as React from "react";
import Link from "next/link";

import { ExternalLink } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@repo/ui/components/ui/navigation-menu";
import { getAppUrl } from "@repo/url-utils";
import { UnauthenticatedMobileNav } from "./layouts/unauthenticated-mobile-nav";

export function EnhancedHeader() {
	const chatUrl = getAppUrl("chat");
	const cloudUrl = getAppUrl("cloud");

	const productLinks: Array<{
		label: string;
		href: string;
		target?: "_blank";
		rel?: string;
		isExternal?: boolean;
	}> = [
		{
			label: "Chat",
			href: chatUrl,
			target: "_blank",
			rel: "noopener noreferrer",
			isExternal: true,
		},
		{
			label: "Cloud",
			href: cloudUrl,
		},
		{
			label: "SDK",
			href: "/docs",
		},
	];

	return (
		<header className="h-14 bg-background px-4 sm:px-6 lg:px-8">
			<div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto h-full flex items-center justify-between">
				<div className="flex items-center">
					<Link href="/">
						<Icons.logo className="size-26 text-foreground" />
					</Link>
				</div>

				{/* Navigation Menu - moved to right, hidden on lg and below */}
				<div className="flex items-center gap-4">
					<NavigationMenu className="hidden xl:flex">
						<NavigationMenuList>
							{/* Products */}
							<NavigationMenuItem>
								<NavigationMenuTrigger
									className={buttonVariants({ variant: "ghost", size: "lg" })}
								>
									Products
								</NavigationMenuTrigger>
								<NavigationMenuContent className="bg-background">
									<div className="flex flex-col gap-3 rounded-sm p-1 md:w-[160px]">
										<div className="flex flex-col gap-1">
											{productLinks.map((item) => (
												<Link
													key={item.label}
													href={item.href}
													target={item.target}
													rel={item.rel}
													className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
												>
													<span>{item.label}</span>
													{item.isExternal ? (
														<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
													) : null}
												</Link>
											))}
										</div>
									</div>
								</NavigationMenuContent>
							</NavigationMenuItem>

							{/* Docs */}
							<NavigationMenuItem>
								<Link
									href="/docs"
									className={buttonVariants({ variant: "ghost", size: "lg" })}
								>
									Docs
								</Link>
							</NavigationMenuItem>
						</NavigationMenuList>
					</NavigationMenu>

					{/* Desktop actions - hidden on lg and below */}
					<div className="hidden xl:flex items-center gap-2">
						<Button variant="default" asChild>
							<Link href={chatUrl} target="_blank" rel="noopener noreferrer">
								Try Chat
							</Link>
						</Button>
						<div className="flex h-4 items-center px-3">
							<Separator orientation="vertical" />
						</div>
						<Button variant="ghost" size="xs" asChild>
							<Link
								href="https://github.com/lightfastai/lightfast"
								target="_blank"
								rel="noopener noreferrer"
							>
								<Icons.gitHub className="h-4 w-4" />
								<span className="sr-only">GitHub</span>
							</Link>
						</Button>
					</div>

					{/* Mobile navigation - shown on lg and below */}
					<div className="xl:hidden">
						<UnauthenticatedMobileNav />
					</div>
				</div>
			</div>
		</header>
	);
}
