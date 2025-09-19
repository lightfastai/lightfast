"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { useClerk } from "@clerk/nextjs";
import { useTRPC } from "~/trpc/react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	MoreHorizontal,
	Share2,
	Loader2,
	Settings,
	CreditCard,
	Crown,
	MessageCircle,
	Timer,
} from "lucide-react";
import { SettingsDialog } from "../settings-dialog";
import Link from "next/link";
import { useBillingContext } from "~/hooks/use-billing-context";
import { toast } from "sonner";
import { TemporarySessionButton } from "./temporary-session-badge";

const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractSessionId(pathname: string): string | null {
	const segments = pathname.split("/").filter(Boolean);

	if (segments.length !== 1) {
		return null;
	}

	const [candidate] = segments;

	if (!candidate) {
		return null;
	}

	if (candidate === "new" || candidate === "billing" || candidate === "share") {
		return null;
	}

	if (!SESSION_ID_REGEX.test(candidate)) {
		return null;
	}

	return candidate;
}

export function MobileActionsMenu() {
	const { signOut } = useClerk();
	const [settingsOpen, setSettingsOpen] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const trpc = useTRPC();

	const sessionId = useMemo(() => extractSessionId(pathname), [pathname]);
	const mode = searchParams.get("mode");
	const temporary = searchParams.get("temporary");
	const isTemporaryRoute = mode === "temporary" || temporary === "1";
	const isOnNewPage = pathname === "/new";

	// Get user info from tRPC - using suspense for instant loading
	const { data: user } = useSuspenseQuery({
		...trpc.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});

	// Get billing context with usage and plan information
	const billingContext = useBillingContext();
	const { usageSummary, capabilities, isAuthenticated, isLoaded } = {
		usageSummary: billingContext.usage.summary,
		capabilities: billingContext.plan.capabilities,
		isAuthenticated: billingContext.plan.isAuthenticated,
		isLoaded: billingContext.isLoaded,
	};

	const shareMutation = useMutation(
		trpc.share.create.mutationOptions({
			onError: (error) => {
				toast.error("Couldn't create share link", {
					description: error.message || "Please try again in a moment.",
				});
			},
		}),
	);

	const handleSignOut = async () => {
		await signOut(); // Will use afterSignOutUrl from Clerk config
	};

	const handleToggleTemporaryChat = () => {
		router.replace(isTemporaryRoute ? "/new" : "/new?mode=temporary");
	};

	const canStartTemporaryChat = billingContext.plan.isPlusUser && isOnNewPage;
	const toggleTooltip = isTemporaryRoute
		? "Disable temporary chat"
		: "Start temporary chat";

	const handleShare = async () => {
		if (!sessionId || shareMutation.isPending) {
			return;
		}

		try {
			const result = await shareMutation.mutateAsync({ sessionId });
			const shareUrl = `${window.location.origin}/share/${result.shareId}`;

			let copied = false;
			try {
				await navigator.clipboard.writeText(shareUrl);
				copied = true;
			} catch (error) {
				console.warn("[MobileActionsMenu] Failed to copy share link", error);
			}

			if (!copied) {
				window.prompt("Share this link", shareUrl);
			}

			toast.success(copied ? "Share link copied" : "Share link ready", {
				description: shareUrl,
			});
		} catch (error) {
			console.error("[MobileActionsMenu] Failed to create share link", error);
			// Error toast handled in onError above when available
			if (!(error instanceof Error)) {
				toast.error("Couldn't create share link");
			}
		}
	};

	// Get user initials for fallback
	const getInitials = () => {
		// Check if user has firstName and lastName
		if (user.firstName && user.lastName) {
			return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
		}

		// Fall back to firstName or lastName alone
		if (user.firstName) {
			return user.firstName.slice(0, 2).toUpperCase();
		}
		if (user.lastName) {
			return user.lastName.slice(0, 2).toUpperCase();
		}

		// Fall back to username
		if (user.username) {
			return user.username.slice(0, 2).toUpperCase();
		}

		// Fall back to email
		if (user.email && user.email.length > 0) {
			return user.email.charAt(0).toUpperCase();
		}

		return "U";
	};

	return (
		<>
			{canStartTemporaryChat ? (
				<TemporarySessionButton
					active={isTemporaryRoute}
					onToggle={handleToggleTemporaryChat}
					tooltip={toggleTooltip}
					className="mr-1"
				/>
			) : null}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					{/* User Info Section */}
					<div className="flex items-center gap-2 px-2 py-1.5">
						<Avatar className="h-5 w-5">
							<AvatarFallback className="text-[10px] bg-blue-300 text-white">
								{getInitials()}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-xs text-muted-foreground truncate">
								{user.email ?? user.username ?? "User"}
							</p>
							<p className="text-xs font-medium text-foreground">
								{capabilities.planName} Plan
							</p>
						</div>
					</div>

					{/* Share Session - only show if there's a valid session and not in temporary mode */}
					{sessionId && !isTemporaryRoute && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={handleShare} disabled={shareMutation.isPending} className="cursor-pointer">
								{shareMutation.isPending ? (
									<Loader2 className="mr-2 h-3 w-3 animate-spin" />
								) : (
									<Share2 className="mr-2 h-3 w-3" />
								)}
								<span className="text-xs font-medium">Share</span>
							</DropdownMenuItem>
						</>
					)}

					{/* Usage Section */}
					{isAuthenticated && isLoaded && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuLabel className="text-2xs text-muted-foreground">
								Usage
							</DropdownMenuLabel>
							<div className="px-2 pb-2 space-y-2">
								{usageSummary ? (
									<>
										{/* Standard Messages */}
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
													{" "}
													/ {usageSummary.nonPremiumLimit}
												</span>
											</div>
										</div>

										{/* Premium Messages - ALWAYS show for motivation/awareness */}
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
															{" "}
															/ {usageSummary.premiumLimit}
														</span>
													</>
												) : (
													<Link
														href="/billing/upgrade"
														prefetch={true}
														className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
													>
														Upgrade to unlock
													</Link>
												)}
											</div>
										</div>
									</>
								) : (
									<div className="text-xs text-muted-foreground">
										Loading usage data...
									</div>
								)}
							</div>
						</>
					)}

					{canStartTemporaryChat && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={(event) => {
									event.preventDefault();
									handleToggleTemporaryChat();
							}}
								className="cursor-pointer"
							>
								<Timer className="mr-2 h-3 w-3" />
								<span className="text-xs">
									{isTemporaryRoute ? "Disable temporary chat" : "Start temporary chat"}
								</span>
							</DropdownMenuItem>
						</>
					)}

					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link href="/billing" prefetch={true} className="cursor-pointer">
							<CreditCard className="mr-2 h-3 w-3" />
							<span className="text-xs">{capabilities.isPlusUser ? "Manage Plan" : "Upgrade Plan"}</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setSettingsOpen(true)}
						className="cursor-pointer"
					>
						<Settings className="mr-2 h-3 w-3" />
						<span className="text-xs">Settings</span>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
						<span className="text-xs">Sign out</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Settings Dialog - controlled by state */}
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</>
	);
}
