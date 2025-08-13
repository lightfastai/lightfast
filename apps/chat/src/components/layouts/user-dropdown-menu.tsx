"use client";

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
} from "@repo/ui/components/ui/dropdown-menu";

interface UserDropdownMenuProps {
	className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
	const { signOut } = useClerk();

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
				<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

