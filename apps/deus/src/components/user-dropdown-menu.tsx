"use client";

import { useMemo } from "react";
import {
	SignInButton,
	SignedIn,
	SignedOut,
	useClerk,
	useUser,
} from "@clerk/nextjs";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { GitBranch, Settings } from "lucide-react";
import Link from "next/link";

import { ConnectRepositoryDialog } from "./connect-repository-dialog";

interface UserDropdownMenuProps {
	className?: string;
}

export function UserDropdownMenu({ className }: UserDropdownMenuProps) {
	const { signOut } = useClerk();
	const { isLoaded, isSignedIn, user } = useUser();

	const displayName = useMemo(() => {
		if (!user) {
			return "";
		}

		return (
			user.fullName ??
			user.username ??
			user.primaryEmailAddress?.emailAddress ??
			user.emailAddresses[0]?.emailAddress ??
			"User"
		);
	}, [user]);

	const emailAddress = useMemo(() => {
		if (!user) {
			return "";
		}

		return (
			user.primaryEmailAddress?.emailAddress ??
			user.emailAddresses[0]?.emailAddress ??
			user.username ??
			""
		);
	}, [user]);

	const initials = useMemo(() => {
		if (!user) {
			return "";
		}

		const { firstName, lastName, username } = user;

		if (firstName && lastName) {
			return `${firstName[0]}${lastName[0]}`.toUpperCase();
		}

		if (firstName) {
			return firstName.substring(0, 2).toUpperCase();
		}

		if (lastName) {
			return lastName.substring(0, 2).toUpperCase();
		}

		if (username) {
			return username.substring(0, 2).toUpperCase();
		}

		return "LF";
	}, [user]);

	const handleSignOut = () => {
		void signOut();
	};

	if (!isLoaded) {
		return (
			<div
				className={cn(
					"h-10 w-10 animate-pulse rounded-full border border-border/50 bg-muted/40",
					className,
				)}
			/>
		);
	}

	return (
		<>
			<SignedIn>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"h-10 gap-2 rounded-full border border-border/40 bg-transparent px-1.5 text-foreground/80 hover:border-border hover:bg-muted/60",
								className,
							)}
						>
							<Avatar className="h-8 w-8">
								{user?.imageUrl ? (
									<AvatarImage src={user.imageUrl} alt={displayName || "User avatar"} />
								) : (
									<AvatarFallback className="text-xs font-medium uppercase">
										{initials}
									</AvatarFallback>
								)}
							</Avatar>
							<span className="hidden text-sm font-medium text-foreground sm:inline">
								{displayName}
							</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<div className="px-3 py-2">
							<p className="text-xs text-muted-foreground">{emailAddress}</p>
						</div>
						<DropdownMenuSeparator />
						<Link href="/settings">
							<DropdownMenuItem className="cursor-pointer gap-2">
								<Settings className="h-4 w-4" />
								<span>Settings</span>
							</DropdownMenuItem>
						</Link>
						<ConnectRepositoryDialog>
							<DropdownMenuItem
								onSelect={(e) => e.preventDefault()}
								className="cursor-pointer gap-2"
							>
								<GitBranch className="h-4 w-4" />
								<span>Connect repository</span>
							</DropdownMenuItem>
						</ConnectRepositoryDialog>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SignedIn>
			{!isSignedIn && (
				<SignedOut>
					<SignInButton mode="modal">
						<Button variant="outline" size="sm" className={className}>
							Sign in
						</Button>
					</SignInButton>
				</SignedOut>
			)}
		</>
	);
}
