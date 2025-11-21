"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { Workspace } from "~/types";

interface WorkspaceSwitcherProps {
	orgSlug: string;
	workspaceName: string;
}

export function WorkspaceSwitcher({ orgSlug, workspaceName }: WorkspaceSwitcherProps) {
	const trpc = useTRPC();
	const router = useRouter();
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

	const handleSelectWorkspace = useCallback(
		(workspace: Workspace) => {
			setOpen(false);
			if (currentOrg) {
				router.push(`/${currentOrg.slug}/${workspace.name}`);
			}
		},
		[router, currentOrg],
	);

	// Hide component until data is ready (after all hooks are called)
	if (!currentOrg || isLoadingWorkspaces) {
		return null;
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="justify-between px-2 h-9 hover:bg-accent min-w-0"
				>
					<span className="text-sm font-medium truncate">
						{currentWorkspace?.name ?? workspaceName}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[280px] space-y-1" align="start">
				<div className="px-2 py-1.5">
					<p className="text-xs font-medium text-muted-foreground">
						Workspaces
					</p>
				</div>
				{workspaces.map((workspace) => (
					<DropdownMenuItem
						key={workspace.id}
						onClick={() => handleSelectWorkspace(workspace)}
						className={cn(
							"cursor-pointer",
							currentWorkspace?.id === workspace.id && "bg-muted/50",
						)}
					>
						<span className="truncate flex-1 text-left">
							{workspace.name}
						</span>
						{currentWorkspace?.id === workspace.id && (
							<Check className="h-4 w-4 shrink-0 text-foreground" />
						)}
					</DropdownMenuItem>
				))}

				{/* Create Workspace */}
				<DropdownMenuItem asChild>
					<Link
						href="/new"
						prefetch={true}
						className="w-full flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
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
