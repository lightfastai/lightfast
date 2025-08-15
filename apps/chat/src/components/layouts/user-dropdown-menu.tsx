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
} from "@repo/ui/components/ui/dropdown-menu";
import { Settings, Gamepad2 } from "lucide-react";
import { SettingsDialog } from "~/components/settings/settings-dialog";

interface UserDropdownMenuProps {
	className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
	const { signOut } = useClerk();
	const [settingsOpen, setSettingsOpen] = useState(false);

	// Get user info from tRPC - using suspense for instant loading
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});

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
				<DropdownMenuContent align="end">
					<div className="px-2 py-1.5">
						<p className="text-xs text-muted-foreground">
							{user.email || user.username || "User"}
						</p>
					</div>
					<DropdownMenuItem 
						disabled
					>
						<Gamepad2 className="mr-2 h-3 w-3" />
						Upgrade Plan
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
			<SettingsDialog 
				open={settingsOpen} 
				onOpenChange={setSettingsOpen} 
			/>
		</>
	);
}

