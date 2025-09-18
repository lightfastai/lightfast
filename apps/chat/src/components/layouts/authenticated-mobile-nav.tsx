"use client";

import * as React from "react";
import Link from "next/link";
import {
	Menu,
	X,
	LogOut,
	User,
	CreditCard,
	Settings,
	Crown,
	MessageCircle,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Sheet, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import { Separator } from "@repo/ui/components/ui/separator";
import { getAppUrl } from "@repo/url-utils";
import { useClerk, useUser } from "@clerk/nextjs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useBillingContext } from "~/hooks/use-billing-context";
import { SettingsDialog } from "../settings-dialog";

export function AuthenticatedMobileNav() {
	const [open, setOpen] = React.useState(false);
	const [settingsOpen, setSettingsOpen] = React.useState(false);
	const cloudUrl = getAppUrl("cloud");
	const { signOut } = useClerk();
	const { user: clerkUser } = useUser();
	const trpc = useTRPC();
	const { data: userData } = useSuspenseQuery({
		...trpc.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000,
	});
	const billingContext = useBillingContext();
	const usageSummary = billingContext.usage.summary;
	const capabilities = billingContext.plan.capabilities;
	const isAuthenticated = billingContext.plan.isAuthenticated;
	const isLoaded = billingContext.isLoaded;

	const userPrimaryText =
		userData.email ??
		clerkUser?.primaryEmailAddress?.emailAddress ??
		userData.username ??
		clerkUser?.username ??
		"User";
	const planLabel = `${capabilities.planName} Plan`;
	const billingLinkLabel =
		capabilities.isPlusUser ? "Manage Plan" : "Upgrade Plan";

	const handleSignOut = async () => {
		await signOut();
		setOpen(false);
	};

	const handleOpenSettings = () => {
		setOpen(false);
		setSettingsOpen(true);
	};

	return (
		<>
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
				<SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-screen flex-col bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
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
					{clerkUser && (
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
								<User className="h-5 w-5" />
							</div>
							<div>
								<p className="text-sm font-medium">{userPrimaryText}</p>
								<p className="text-xs text-muted-foreground">{planLabel}</p>
							</div>
						</div>
					)}

					{isAuthenticated && isLoaded && (
						<div className="mt-6 space-y-3">
							<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
								Usage
							</div>
							{usageSummary ? (
								<div className="space-y-3">
									<div className="flex items-center justify-between text-xs">
										<div className="flex items-center gap-1.5">
											<MessageCircle className="w-3 h-3" />
											<span>Standard</span>
										</div>
										<div className="text-right">
											<span className="font-medium">
												{usageSummary.nonPremiumUsed}
											</span>
											<span className="text-muted-foreground">
												{" "}/ {usageSummary.nonPremiumLimit}
											</span>
										</div>
									</div>
									<div className="flex items-center justify-between text-xs">
										<div className="flex items-center gap-1.5">
											<Crown className="w-3 h-3 text-amber-500" />
											<span>Premium</span>
										</div>
										<div className="text-right">
											{capabilities.canUsePremiumModels ? (
												<>
													<span className="font-medium">
														{usageSummary.premiumUsed}
													</span>
													<span className="text-muted-foreground">
														{" "}/ {usageSummary.premiumLimit}
													</span>
												</>
											) : (
												<Link
													href="/billing/upgrade"
													onClick={() => setOpen(false)}
													className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
												>
													Upgrade to unlock
												</Link>
											)}
										</div>
									</div>
								</div>
							) : (
								<div className="text-xs text-muted-foreground">
									Loading usage data...
								</div>
							)}
						</div>
					)}
					</div>

					{/* Content */}
					<div className="flex flex-1 flex-col">
						<ScrollArea className="flex-1 overflow-hidden">
							<div className="px-6">
								{/* Actions */}
								<div className="space-y-1">
									<Link
										href="/new"
										onClick={() => setOpen(false)}
										className="flex items-center gap-3 text-lg font-medium py-3 hover:bg-accent rounded-lg px-3 -mx-3 transition-colors"
									>
										<Icons.newChat className="h-5 w-5" />
										New Chat
									</Link>
									<Link
										href="/billing"
										onClick={() => setOpen(false)}
										className="flex items-center gap-3 text-lg font-medium py-3 hover:bg-accent rounded-lg px-3 -mx-3 transition-colors"
									>
										<CreditCard className="h-5 w-5" />
										{billingLinkLabel}
									</Link>
									<button
										type="button"
										onClick={handleOpenSettings}
										className="flex w-full items-center gap-3 text-lg font-medium py-3 hover:bg-accent rounded-lg px-3 -mx-3 transition-colors"
									>
										<Settings className="h-5 w-5" />
										Settings
									</button>
								</div>

								{/* Divider */}
								<Separator className="my-6" />

								{/* Products section */}
								<div className="space-y-3">
									<div className="text-sm text-muted-foreground">Products</div>
									<div className="space-y-1">
										<Link
											href="/"
											onClick={() => setOpen(false)}
											className="block text-lg font-medium py-2 text-foreground transition-colors hover:text-muted-foreground"
										>
											Chat
										</Link>
										<Link
											href={cloudUrl}
											onClick={() => setOpen(false)}
											className="block text-lg font-medium py-2 transition-colors hover:text-muted-foreground"
										>
											Cloud
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
		<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</>
	);
}
