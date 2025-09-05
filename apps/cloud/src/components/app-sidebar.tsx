"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LayoutDashboard, Settings, LogOut, Key } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";
import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "@repo/ui/components/ui/sidebar";

interface NavigationItem {
	name: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
}

interface NavigationSection {
	title: string;
	items: NavigationItem[];
}

const navigationSections: NavigationSection[] = [
	{
		title: "Platform",
		items: [
			{
				name: "Dashboard",
				href: "/dashboard",
				icon: LayoutDashboard,
			},
		],
	},
	{
		title: "Manage",
		items: [
			{
				name: "Settings",
				href: "/settings",
				icon: Settings,
			},
		],
	},
];

function UserSection() {
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
	});
	const { signOut } = useClerk();
	const { state } = useSidebar();

	const displayName = 
		user?.firstName && user?.lastName 
			? `${user.firstName} ${user.lastName}`
			: user?.username ?? user?.email ?? "User";
	const displayEmail = user?.email ?? "";
	const avatarUrl = user?.imageUrl;

	const handleSignOut = () => {
		void signOut({ redirectUrl: "/" });
	};

	return (
		<SidebarGroup>
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="h-8 w-8">
										<AvatarImage src={avatarUrl || undefined} alt={displayName} />
										<AvatarFallback className="bg-primary/10 text-primary">
											{displayName.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">{displayName}</span>
										{displayEmail && state === "expanded" && (
											<span className="truncate text-xs text-muted-foreground">
												{displayEmail}
											</span>
										)}
									</div>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							
							<DropdownMenuContent 
								className="w-56" 
								align="start" 
								side="right"
								sideOffset={4}
							>
								<DropdownMenuLabel className="font-normal">
									<div className="flex flex-col space-y-1">
										<p className="text-sm font-medium leading-none">
											{displayName}
										</p>
										{displayEmail && (
											<p className="text-xs leading-none text-muted-foreground">
												{displayEmail}
											</p>
										)}
									</div>
								</DropdownMenuLabel>
								
								<DropdownMenuSeparator />
								
								<DropdownMenuItem asChild>
									<Link href="/settings" className="flex items-center cursor-pointer">
										<Settings className="mr-2 h-4 w-4" />
										Settings
									</Link>
								</DropdownMenuItem>
								
								<DropdownMenuItem asChild>
									<Link href="/settings/api-keys" className="flex items-center cursor-pointer">
										<Key className="mr-2 h-4 w-4" />
										API Keys
									</Link>
								</DropdownMenuItem>
								
								<DropdownMenuSeparator />
								
								<DropdownMenuItem 
									className="text-red-600 focus:text-red-600 cursor-pointer"
									onClick={handleSignOut}
								>
									<LogOut className="mr-2 h-4 w-4" />
									Sign Out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

interface AppSidebarProps {
	organizationId?: string;
}

export function AppSidebar({ organizationId }: AppSidebarProps) {
	const pathname = usePathname();

	return (
		<Sidebar variant="inset" collapsible="icon">
			<SidebarHeader className="h-16">
				<div className="flex items-center justify-between px-4 h-full group-data-[collapsible=icon]:justify-center">
					{/* Logo only shows when expanded */}
					<Link
						href="/dashboard"
						className="flex items-center group-data-[collapsible=icon]:hidden"
					>
						<Icons.logo className="h-4 w-auto" />
					</Link>
					{/* Sidebar trigger - shows on right when expanded, center when collapsed */}
					<SidebarTrigger className="-mr-1 group-data-[collapsible=icon]:mr-0" />
				</div>

			</SidebarHeader>

			<SidebarContent>
				{navigationSections.map((section) => (
					<SidebarGroup key={section.title}>
						<SidebarGroupLabel>{section.title}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{section.items.map((item) => {
									const isActive =
										pathname === item.href ||
										pathname.startsWith(item.href + "/");
									return (
										<SidebarMenuItem key={item.name}>
											<SidebarMenuButton
												asChild
												tooltip={item.name}
												isActive={isActive}
											>
												<Link href={item.href}>
													<item.icon />
													<span>{item.name}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<UserSection />
			</SidebarFooter>
		</Sidebar>
	);
}

