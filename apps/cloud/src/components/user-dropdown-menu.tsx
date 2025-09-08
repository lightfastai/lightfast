"use client";

import React from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { Settings, LogOut, Key, Building2, Check } from "lucide-react";
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
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@repo/ui/components/ui/sidebar";

export const UserDropdownMenu = React.memo(function UserDropdownMenu() {
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.user.getUser.queryOptions(),
		staleTime: Infinity, // User profile data rarely changes, cache for entire session
		gcTime: Infinity, // Keep in cache indefinitely
	});
	const { data: organizations } = useSuspenseQuery({
		...trpc.user.getUserOrganizations.queryOptions(),
		staleTime: 5 * 60 * 1000, // 5 minutes - organizations can change more frequently
		gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
	});

	console.log("Organizations data:", organizations);
	const { signOut, setActive } = useClerk();
	const { state } = useSidebar();
	const router = useRouter();
	const pathname = usePathname();

	const displayName =
		user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: (user.username ?? user.email ?? "User");
	const displayEmail = user.email ?? "";
	const avatarUrl = user.imageUrl;

	const handleSignOut = () => {
		void signOut({ redirectUrl: "/" });
	};

	const handleOrganizationSwitch = async (
		organizationId: string,
		slug: string,
	) => {
		try {
			await setActive({ organization: organizationId });
			router.push(`/orgs/${slug}/dashboard`);
		} catch (error) {
			console.error("Failed to switch organization:", error);
		}
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
										<AvatarImage
											src={avatarUrl ?? undefined}
											alt={displayName}
										/>
										<AvatarFallback className="bg-primary/10 text-primary">
											{displayName.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{displayName}
										</span>
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

								{organizations && organizations.length > 0 && (
									<>
										{organizations.map((org) => (
											<DropdownMenuItem
												key={org.id}
												className="cursor-pointer"
												onClick={() =>
													handleOrganizationSwitch(org.id, org.slug)
												}
											>
												<div className="flex items-center justify-between w-full">
													<span className="text-xs truncate">{org.name}</span>
													{pathname.includes(`/orgs/${org.slug}`) && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</div>
											</DropdownMenuItem>
										))}
									</>
								)}

								<DropdownMenuSeparator />

								<DropdownMenuItem asChild>
									<Link
										href="/settings"
										className="flex items-center cursor-pointer"
									>
										<Settings className="mr-2 h-4 w-4" />
										Settings
									</Link>
								</DropdownMenuItem>

								<DropdownMenuItem asChild>
									<Link
										href="/settings/api-keys"
										className="flex items-center cursor-pointer"
									>
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
});
