"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { useClerk } from "@clerk/nextjs";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";
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

	// Get user info from tRPC
	const trpc = useTRPC();
	const { data: user } = useQuery({
		...trpc.auth.user.getUser.queryOptions(),
	});

	const handleSignOut = async () => {
		await signOut(); // Will use afterSignOutUrl from Clerk config
	};

	// Get user initials for fallback
	const getInitials = () => {
		if (!user) return "U";

		// Check if user has name field
		if (user.name) {
			const nameParts = user.name.split(" ");
			if (nameParts.length >= 2) {
				return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
			}
			return user.name.slice(0, 2).toUpperCase();
		}

		// Fall back to email
		if (user.email) {
			return user.email[0].toUpperCase();
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

