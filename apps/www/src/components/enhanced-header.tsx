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
				<Button variant="ghost" size="lg" asChild>
					<Link href="/">
						<Icons.logoShort className="size-6 text-foreground" />
					</Link>
				</Button>

				<div className="flex h-4 items-center px-4">
					<Separator orientation="vertical" />
				</div>

				{/* Navigation Menu */}
				<NavigationMenu className="hidden md:flex ml-4">
					<NavigationMenuList>
						{/* Products */}
						<NavigationMenuItem>
							<NavigationMenuTrigger
								className={buttonVariants({ variant: "ghost", size: "lg" })}
							>
								Products
							</NavigationMenuTrigger>
							<NavigationMenuContent>
								<div className="flex gap-2 md:w-[500px] lg:w-[300px]">
									<div className="flex flex-col gap-2 flex-1">
										<Link
											href={cloudUrl}
											className="block p-3 hover:bg-accent rounded-md transition-colors"
										>
											<div className="text-sm font-medium leading-none">
												Cloud
											</div>
											<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
												Enterprise-grade AI infrastructure built for scale and
												reliability.
											</p>
										</Link>
										<Link
											href={chatUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="block p-3 hover:bg-accent rounded-md transition-colors"
										>
											<div className="text-sm font-medium leading-none">
												Chat
											</div>
											<p className="text-muted-foreground line-clamp-2 text-sm leading-snug mt-1">
												Interactive AI chat experiences for your applications.
											</p>
										</Link>
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

						{/* Pricing */}
						<NavigationMenuItem>
							<Link
								href="/pricing"
								className={buttonVariants({ variant: "ghost", size: "lg" })}
							>
								Pricing
							</Link>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			{/* Right side actions */}
			<div className="flex items-center gap-2">
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
		</header>
	);
}
