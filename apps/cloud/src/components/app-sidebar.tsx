"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Settings, MessageSquare } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";
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
} from "@repo/ui/components/ui/sidebar";
import { UserDropdownMenu } from "~/components/user-dropdown-menu";

interface NavigationItem {
	name: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
}

interface NavigationSection {
	title: string;
	items: NavigationItem[];
}

const getNavigationSections = (orgSlug: string): NavigationSection[] => [
	{
		title: "Platform",
		items: [
			{
				name: "Agents",
				href: `/orgs/${orgSlug}/agent`,
				icon: MessageSquare,
			},
		],
	},
	{
		title: "Manage",
		items: [
			{
				name: "Settings",
				href: `/orgs/${orgSlug}/settings/api-keys`,
				icon: Settings,
			},
		],
	},
];

export function AppSidebar() {
	const pathname = usePathname();
	const params = useParams();
	const orgSlug = params.slug as string;

	const navigationSections = getNavigationSections(orgSlug);

	return (
		<Sidebar variant="inset" collapsible="icon">
			<SidebarHeader className="h-16">
				<div className="flex items-center justify-between px-4 h-full group-data-[collapsible=icon]:justify-center">
					{/* Logo only shows when expanded */}
					<Link
						href={`/orgs/${orgSlug}/agent`}
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
				<UserDropdownMenu />
			</SidebarFooter>
		</Sidebar>
	);
}
