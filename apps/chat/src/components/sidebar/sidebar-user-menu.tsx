"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	SidebarMenuButton,
	useSidebar,
} from "@repo/ui/components/ui/sidebar";
import { useAuth } from "@clerk/nextjs";
import {
	ChevronDown,
	LogOut,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SidebarUserMenu() {
	const { signOut } = useAuth();
	const router = useRouter();
	const { state } = useSidebar();
	const [open, setOpen] = useState(false);

	// Close dropdown when sidebar state changes
	useEffect(() => {
		if (state === "collapsed") {
			setOpen(false);
		}
	}, [state]);

	const handleSignOut = async () => {
		await signOut();
		router.push("/");
	};

	// TODO: Get user from auth
	const displayName = "User";
	const displayEmail = "user@example.com";

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton
					size="default"
					className="w-full group-data-[collapsible=icon]:!p-0 !p-0 overflow-visible"
					data-state={open ? "open" : "closed"}
				>
					<div className="h-8 flex items-center w-full overflow-visible">
						<div className="w-8 h-8 flex-shrink-0 overflow-visible">
							<Avatar className="w-8 h-8 !rounded-md">
								<AvatarFallback className="text-xs !rounded-md">
									<User className="w-4 h-4" />
								</AvatarFallback>
							</Avatar>
						</div>
						<div className="flex items-center gap-2 px-2 flex-1 group-data-[collapsible=icon]:hidden">
							<span className="flex-1 truncate text-left text-xs">
								{displayName}
							</span>
							<ChevronDown className="w-3 h-3" />
						</div>
					</div>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56"
				side="right"
				sideOffset={8}
			>
				<DropdownMenuLabel>
					<div className="flex flex-col space-y-1">
						<p className="text-xs font-medium leading-none">{displayName}</p>
						<p className="text-xs leading-none text-muted-foreground opacity-75">
							{displayEmail}
						</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link
						href="/settings"
						className="cursor-pointer flex items-center"
						prefetch={true}
					>
						<Settings className="mr-2 h-3 w-3" />
						<span className="text-xs">Settings</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
					<LogOut className="mr-2 h-3 w-3" />
					<span className="text-xs">Sign out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}