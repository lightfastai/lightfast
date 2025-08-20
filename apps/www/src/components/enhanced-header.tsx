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
import { UnauthenticatedMobileNav } from "./layouts/unauthenticated-mobile-nav";

export function EnhancedHeader() {
	const chatUrl = getAppUrl("chat");
	const cloudUrl = getAppUrl("cloud");

	return (
		<header className="h-14 bg-background">
			<div className="max-w-7xl mx-auto h-full flex items-center justify-between">
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
									<div className="flex flex-col gap-3 p-3 rounded-sm md:w-[300px]">
										<h3 className="text-2xs font-medium text-muted-foreground px-4">
											Core Features
										</h3>
										{/* Chat Product */}
										<Button
											variant="ghost"
											className="h-auto justify-start w-full"
											asChild
										>
											<Link
												href={chatUrl}
												target="_blank"
												rel="noopener noreferrer"
											>
												<div className="text-left w-full">
													<div className="text-xs font-medium leading-none mb-1">
														Chat
													</div>
													<p className="text-muted-foreground text-xs leading-snug whitespace-normal break-words">
														Interactive AI assistant for your development
														workflow
													</p>
												</div>
											</Link>
										</Button>

										{/* Cloud Product */}
										<Button
											variant="ghost"
											className="h-auto justify-start w-full"
											asChild
										>
											<Link href={cloudUrl}>
												<div className="text-left w-full">
													<div className="text-xs font-medium leading-none mb-1">
														Cloud
													</div>
													<p className="text-muted-foreground text-xs leading-snug whitespace-normal break-words">
														Managed infrastructure for deploying AI agents at
														scale
													</p>
												</div>
											</Link>
										</Button>

										{/* SDK Product */}
										<Button
											variant="ghost"
											className="h-auto justify-start w-full"
											asChild
										>
											<Link href="/docs/sdk">
												<div className="text-left w-full">
													<div className="text-xs font-medium leading-none mb-1">
														SDK
													</div>
													<p className="text-muted-foreground text-xs leading-snug whitespace-normal break-words">
														Developer tools for building and orchestrating AI
														agents
													</p>
												</div>
											</Link>
										</Button>
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
