"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { useClerk } from "@clerk/nextjs";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@repo/ui/components/ui/dropdown-menu";
import { Settings, CreditCard, Crown, MessageCircle } from "lucide-react";
import { SettingsDialog } from "~/components/settings-dialog";
import Link from "next/link";
import { useBillingContext } from "~/hooks/use-billing-context";

interface UserDropdownMenuProps {
	className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
	const { signOut } = useClerk();
	const [settingsOpen, setSettingsOpen] = useState(false);

	// Get user info from tRPC - using suspense for instant loading
	const trpc = useTRPC();
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

	const handleSignOut = async () => {
		await signOut(); // Will use afterSignOutUrl from Clerk config
	};


	// Get user initials for fallback
	// Note: user is guaranteed to exist with useSuspenseQuery
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
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className={className}>
						<Avatar className="h-5 w-5">
							<AvatarFallback className="text-[10px] bg-blue-300 text-white">
								{getInitials()}
							</AvatarFallback>
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<div className="px-2 py-1.5">
						<p className="text-xs text-muted-foreground">
							{user.email ?? user.username ?? "User"}
						</p>
						<p className="text-xs font-medium text-foreground mt-1">
							{capabilities.planName} Plan
						</p>
					</div>

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

					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link href="/billing" className="cursor-pointer">
							<CreditCard className="mr-2 h-3 w-3" />
							{capabilities.isPlusUser ? "Manage Plan" : "Upgrade Plan"}
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => setSettingsOpen(true)}
						className="cursor-pointer"
					>
						<Settings className="mr-2 h-3 w-3" />
						Settings
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Settings Dialog - controlled by state */}
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</>
	);
}
