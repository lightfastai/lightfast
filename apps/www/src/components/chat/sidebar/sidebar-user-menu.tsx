"use client";

import { siteConfig } from "@/lib/site-config";
import { useAuthActions } from "@convex-dev/auth/react";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@lightfast/ui/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@lightfast/ui/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@lightfast/ui/components/ui/sidebar";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import {
	ChevronDown,
	ExternalLink,
	LogOut,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { api } from "../../../../convex/_generated/api";

interface SidebarUserMenuProps {
	preloadedUser: Preloaded<typeof api.users.current>;
}

export function SidebarUserMenu({ preloadedUser }: SidebarUserMenuProps) {
	const { signOut } = useAuthActions();
	const router = useRouter();
	const currentUser = usePreloadedQuery(preloadedUser);

	const handleSignOut = async () => {
		await signOut();
		router.push("/signin");
	};

	const displayName = currentUser?.name || currentUser?.email || "User";
	const displayEmail = currentUser?.email || "No email";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					size="default"
					className="w-full group-data-[collapsible=icon]:!p-0 !p-0 overflow-visible"
				>
					<div className="h-8 flex items-center w-full overflow-visible">
						<div className="w-8 h-8 flex-shrink-0 overflow-visible">
							<Avatar className="w-8 h-8 !rounded-md">
								{currentUser?.image && (
									<AvatarImage
										src={currentUser.image}
										alt={displayName}
										className="object-cover w-8 h-8 !rounded-md"
									/>
								)}
								<AvatarFallback className="text-xs !rounded-md">
									<User className="w-4 h-4" />
								</AvatarFallback>
							</Avatar>
						</div>
						<div className="flex items-center gap-2 px-2 flex-1 group-data-[collapsible=icon]:hidden">
							<span className="flex-1 truncate text-left">{displayName}</span>
							<ChevronDown className="w-4 h-4" />
						</div>
					</div>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56"
				side="top"
				sideOffset={8}
				alignOffset={0}
				collisionPadding={8}
				avoidCollisions={true}
			>
				<DropdownMenuLabel>
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{displayName}</p>
						<p className="text-xs leading-none text-muted-foreground">
							{displayEmail}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link
						href="/chat/settings"
						className="cursor-pointer"
						prefetch={true}
					>
						<Settings className="mr-2 h-4 w-4" />
						<span>Settings</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link
						href={siteConfig.links.github.href}
						target="_blank"
						rel="noopener noreferrer"
						className="cursor-pointer"
					>
						<ExternalLink className="mr-2 h-4 w-4" />
						<span>GitHub</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
					<LogOut className="mr-2 h-4 w-4" />
					<span>Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
