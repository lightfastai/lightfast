"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { TeamSwitcherLink } from "./team-switcher-link";

interface WorkspaceSwitcherProps {
	orgSlug: string;
	workspaceName: string;
}

export function WorkspaceSwitcher({ orgSlug, workspaceName }: WorkspaceSwitcherProps) {
	const trpc = useTRPC();
	const [open, setOpen] = useState(false);

	// Fetch organizations to get current org
	const { data: organizations = [] } = useSuspenseQuery({
		...trpc.organization.listUserOrganizations.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
	});

	// Find current organization by slug from URL (not Clerk's active org)
	const currentOrg = useMemo(() => {
		if (!orgSlug) return null;
		return organizations.find((org) => org.slug === orgSlug);
	}, [orgSlug, organizations]);

	// Fetch workspaces for current org by slug
	const { data: workspaces = [], isLoading: isLoadingWorkspaces } = useQuery({
		...trpc.workspace.listByClerkOrgSlug.queryOptions({
			clerkOrgSlug: currentOrg?.slug ?? "",
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
		enabled: Boolean(currentOrg?.slug),
	});

	// Find current workspace by name (name is used in URLs)
	const currentWorkspace = useMemo(() => {
		if (!workspaceName) return null;
		return workspaces.find((ws) => ws.name === workspaceName);
	}, [workspaceName, workspaces]);

	// Removed handleSelectWorkspace - now using TeamSwitcherLink pattern

	// Hide component until data is ready (after all hooks are called)
	if (!currentOrg || isLoadingWorkspaces) {
		return null;
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<div className="flex items-center gap-1">
				{/* Clickable area - navigates to workspace (no styling) */}
				{currentWorkspace ? (
					<TeamSwitcherLink
						orgId={currentOrg.id}
						orgSlug={currentOrg.slug}
						workspaceName={currentWorkspace.name}
						className="flex items-center min-w-0"
					>
						<span className="text-sm font-medium truncate">
							{currentWorkspace.name}
						</span>
					</TeamSwitcherLink>
				) : (
					<div className="flex items-center min-w-0">
						<span className="text-sm font-medium truncate">
							{workspaceName}
						</span>
					</div>
				)}

				{/* Dropdown chevron trigger - shadcn ghost button */}
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0"
					>
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent className="w-[280px] space-y-1" align="start">
				<div className="px-2 py-1.5">
					<p className="text-xs font-medium text-muted-foreground">
						Workspaces
					</p>
				</div>
				{workspaces.map((workspace) => {
					const isSelected = currentWorkspace?.id === workspace.id;

					return (
						<DropdownMenuItem key={workspace.id} asChild className="p-0">
							<TeamSwitcherLink
								orgId={currentOrg.id}
								orgSlug={currentOrg.slug}
								workspaceName={workspace.name}
								onSwitch={() => setOpen(false)}
								className={cn(
									"w-full flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-sm hover:bg-accent focus:bg-accent",
									isSelected && "bg-muted/50",
								)}
							>
								<span className="truncate flex-1 text-left">
									{workspace.name}
								</span>
								{isSelected && (
									<Check className="h-4 w-4 shrink-0 text-foreground" />
								)}
							</TeamSwitcherLink>
						</DropdownMenuItem>
					);
				})}

				{/* Create Workspace */}
				<DropdownMenuItem asChild className="p-0">
					<Link
						href="/new"
						prefetch={true}
						className="w-full flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus:bg-accent"
					>
						<div className="flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/50">
							<Plus className="h-3 w-3" />
						</div>
						<span>Create Workspace</span>
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
