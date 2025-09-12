"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import { getAppUrl } from "@repo/url-utils";

export function UnauthenticatedMobileNav() {
	const [open, setOpen] = React.useState(false);
	const chatUrl = getAppUrl("chat");
	const cloudUrl = getAppUrl("cloud");

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Toggle Menu"
				>
					<Menu className="h-5 w-5" />
				</Button>
			</SheetTrigger>
			<SheetPrimitive.Portal>
				<SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 h-full w-screen bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
					{/* Visually hidden title for accessibility */}
					<SheetPrimitive.Title className="sr-only">
						Navigation Menu
					</SheetPrimitive.Title>

					{/* Header */}
					<div className="flex items-center justify-between p-6 pb-4">
						<SheetPrimitive.Close className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
							<X className="h-5 w-5" />
							<span className="text-lg font-medium">Menu</span>
						</SheetPrimitive.Close>
					</div>

					{/* Content */}
					<div className="flex flex-col h-[calc(100vh-5rem)]">
						<ScrollArea className="flex-1 overflow-hidden">
							<div className="px-6 space-y-6">
								{/* Products section */}
								<div className="space-y-3">
									<div className="text-sm text-muted-foreground">Products</div>
									<div className="space-y-3">
										<Link
											href={chatUrl}
											target="_blank"
											rel="noopener noreferrer"
											onClick={() => setOpen(false)}
											className="block"
										>
											<div className="text-2xl font-medium">Chat</div>
											<p className="text-sm text-muted-foreground mt-1">
												Interactive AI assistant for your development workflow
											</p>
										</Link>
										<Link
											href={cloudUrl}
											onClick={() => setOpen(false)}
											className="block"
										>
											<div className="text-2xl font-medium">Cloud</div>
											<p className="text-sm text-muted-foreground mt-1">
												Managed infrastructure for deploying AI agents at scale
											</p>
										</Link>
										<Link
											href="/docs/sdk"
											onClick={() => setOpen(false)}
											className="block"
										>
											<div className="text-2xl font-medium">SDK</div>
											<p className="text-sm text-muted-foreground mt-1">
												Developer tools for building and orchestrating AI agents
											</p>
										</Link>
									</div>
								</div>

								{/* Main Navigation */}
								<div className="space-y-3">
									<div className="text-sm text-muted-foreground">Resources</div>
									<div className="space-y-1">
										<Link
											href="/docs"
											onClick={() => setOpen(false)}
											className="block text-2xl font-medium py-1 transition-colors hover:text-muted-foreground"
										>
											Docs
										</Link>
									</div>
								</div>

								{/* GitHub Link */}
								<div className="pt-6 border-t">
									<Link
										href="https://github.com/lightfastai/lightfast"
										target="_blank"
										rel="noopener noreferrer"
										onClick={() => setOpen(false)}
										className="flex items-center gap-2 text-lg font-medium transition-colors hover:text-muted-foreground"
									>
										<Icons.gitHub className="h-5 w-5" />
										<span>GitHub</span>
									</Link>
								</div>
							</div>
						</ScrollArea>

						{/* Footer with Try Chat button */}
						<div className="border-t p-6">
							<Button className="w-full" asChild>
								<Link
									href={chatUrl}
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setOpen(false)}
								>
									Try Chat
								</Link>
							</Button>
						</div>
					</div>
				</SheetPrimitive.Content>
			</SheetPrimitive.Portal>
		</Sheet>
	);
}