"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X, LogOut, Settings, User } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetTrigger, SheetPrimitive } from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import { Separator } from "@repo/ui/components/ui/separator";
import { useClerk, useUser } from "@clerk/nextjs";
import { env } from "@/env";

interface AuthenticatedMobileNavProps {
	agentId?: string;
	version?: "v1" | "v2";
}

export function AuthenticatedMobileNav({
	agentId,
	version = "v1",
}: AuthenticatedMobileNavProps) {
	const [open, setOpen] = React.useState(false);
	const isDevelopment = env.NEXT_PUBLIC_VERCEL_ENV === 'development' || !env.NEXT_PUBLIC_VERCEL_ENV;
	const chatUrl = isDevelopment
		? 'http://localhost:4106'
		: 'https://chat.lightfast.ai';
	const { signOut } = useClerk();
	const { user } = useUser();
	const newChatHref = version === "v2" ? `/v2-chat/${agentId || "a011"}` : "/";

	const handleSignOut = async () => {
		await signOut();
		setOpen(false);
	};

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

					{/* Header with user info */}
					<div className="p-6 pb-4">
						<div className="flex items-center justify-between mb-4">
							<SheetPrimitive.Close className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
								<X className="h-5 w-5" />
								<span className="text-lg font-medium">Menu</span>
							</SheetPrimitive.Close>
						</div>

						{/* User info */}
						{user && (
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
									<User className="h-5 w-5" />
								</div>
								<div>
									<p className="text-sm font-medium">
										{user.firstName || user.username}
									</p>
									<p className="text-xs text-muted-foreground">
										{user.primaryEmailAddress?.emailAddress}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Content */}
					<div className="flex flex-col h-[calc(100vh-10rem)]">
						<ScrollArea className="flex-1 overflow-hidden">
							<div className="px-6">
								{/* Actions */}
								<div className="space-y-1">
									<Link
										href={newChatHref}
										onClick={() => setOpen(false)}
										className="flex items-center gap-3 text-lg font-medium py-3 hover:bg-accent rounded-lg px-3 -mx-3 transition-colors"
									>
										<Icons.newChat className="h-5 w-5" />
										New Chat
									</Link>
								</div>

								{/* Agent Info if available */}
								{agentId && (
									<>
										<Separator className="my-6" />
										<div className="space-y-3">
											<div className="text-sm text-muted-foreground">Agent</div>
											<div className="px-3 py-2 bg-muted/50 rounded-lg">
												<p className="font-mono text-xs">Version: {agentId}</p>
											</div>
										</div>
									</>
								)}

								{/* Divider */}
								<Separator className="my-6" />

								{/* Products section */}
								<div className="space-y-3">
									<div className="text-sm text-muted-foreground">Products</div>
									<div className="space-y-1">
										<div className="block text-lg font-medium py-2 text-foreground">
											Experimental
										</div>
										<Link
											href={chatUrl}
											onClick={() => setOpen(false)}
											className="block text-lg font-medium py-2 transition-colors hover:text-muted-foreground"
										>
											Chat
										</Link>
									</div>
								</div>
							</div>
						</ScrollArea>

						{/* Footer with Sign Out */}
						<div className="border-t p-6">
							<Button
								variant="outline"
								className="w-full"
								onClick={handleSignOut}
							>
								<LogOut className="h-4 w-4 mr-2" />
								Sign Out
							</Button>
						</div>
					</div>
				</SheetPrimitive.Content>
			</SheetPrimitive.Portal>
		</Sheet>
	);
}

