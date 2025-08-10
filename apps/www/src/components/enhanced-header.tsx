"use client";

import * as React from "react";
import Link from "next/link";

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

export function EnhancedHeader() {
	const chatUrl = getAppUrl("chat");
	const cloudUrl = getAppUrl("cloud");

	return (
		<header className="h-14 flex items-center justify-between app-container bg-background">
			<div className="flex items-center">
				<Button variant="outline" size="xs" asChild>
					<Link href="/">
						<Icons.logoShort className="h-4 w-4" />
					</Link>
				</Button>
				<div className="flex h-4 items-center px-4">
					<Separator orientation="vertical" />
				</div>

				{/* Navigation Menu */}
				<NavigationMenu className="hidden md:flex">
					<NavigationMenuList>
						{/* Products */}
						<NavigationMenuItem>
							<NavigationMenuTrigger
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Products
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<div className="grid gap-2 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
									<Link
										href={cloudUrl}
										className="row-span-3 from-muted/50 to-muted flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline outline-none select-none focus:shadow-md hover:opacity-90"
									>
										<div className="mt-4 mb-2 text-lg font-medium">Cloud</div>
										<p className="text-muted-foreground text-sm leading-tight">
											Enterprise-grade AI infrastructure built for scale and
											reliability.
										</p>
									</Link>
									<Link
										href={chatUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="block p-3 hover:bg-accent rounded-md"
									>
										<div className="text-sm font-medium leading-none">Chat</div>
										<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
											Interactive AI chat experiences for your applications.
										</p>
									</Link>
								</div>
							</NavigationMenuContent>
						</NavigationMenuItem>

						{/* Docs */}
						<NavigationMenuItem>
							<Link
								href="/docs"
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Docs
							</Link>
						</NavigationMenuItem>

						{/* Pricing */}
						<NavigationMenuItem>
							<Link
								href="/pricing"
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Pricing
							</Link>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			{/* Right side actions */}
			<div className="flex items-center">
				<Button size="sm" asChild>
					<Link href={chatUrl}>Try Chat</Link>
				</Button>
				<div className="flex h-4 items-center px-4">
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
		</header>
	);
}
