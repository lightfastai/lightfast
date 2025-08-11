"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { getAppUrl } from "@repo/url-utils";

export function UnauthenticatedMobileNav() {
	const [open, setOpen] = React.useState(false);
	const cloudUrl = getAppUrl("cloud");
	const authUrl = getAppUrl("auth");

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="lg:hidden"
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
							<div className="px-6">
								{/* Products section */}
								<div className="space-y-3">
									<div className="text-sm text-muted-foreground">Products</div>
									<div className="space-y-1">
										<div className="block text-2xl font-medium py-1 text-foreground">
											Chat
										</div>
										<Link
											href={cloudUrl}
											onClick={() => setOpen(false)}
											className="block text-2xl font-medium py-1 transition-colors hover:text-muted-foreground"
										>
											Cloud
										</Link>
									</div>
								</div>
							</div>
						</ScrollArea>

						{/* Footer with Login/Signup */}
						<div className="border-t p-6 flex gap-3">
							<Button variant="outline" className="flex-1" asChild>
								<Link href={`${authUrl}/sign-in`} onClick={() => setOpen(false)}>
									Log In
								</Link>
							</Button>
							<Button className="flex-1" asChild>
								<Link href={`${authUrl}/sign-up`} onClick={() => setOpen(false)}>
									Sign Up
								</Link>
							</Button>
						</div>
					</div>
				</SheetPrimitive.Content>
			</SheetPrimitive.Portal>
		</Sheet>
	);
}