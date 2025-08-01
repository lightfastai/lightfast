"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UserDropdownProps {
	className?: string;
}

export function UserDropdown({ className }: UserDropdownProps) {
	const { signOut } = useClerk();
	const router = useRouter();

	const handleSignOut = async () => {
		try {
			await signOut();
			router.push("/");
		} catch (_error) {
			// Handle sign out error silently
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon" className={cn("h-8 w-8", className)}>
					<User className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
					<LogOut className="mr-2 h-4 w-4" />
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
