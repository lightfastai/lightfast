"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import type { RouterOutputs } from "@repo/console-trpc/types";
import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";

/**
 * Workspace data
 */
type WorkspaceData = RouterOutputs["workspace"]["listByClerkOrgId"][number];

interface WorkspaceSwitcherProps {
	workspaceSlug: string;
}

export function WorkspaceSwitcher({ workspaceSlug }: WorkspaceSwitcherProps) {
	const trpc = useTRPC();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const { organization: activeOrg } = useOrganization();

	// Fetch organizations to get current org
	const { data: organizations = [] } = useSuspenseQuery({
		...trpc.organization.listUserOrganizations.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
	});

	// Find current organization
	const currentOrg = useMemo(() => {
		if (!activeOrg) return null;
		return organizations.find((org) => org.id === activeOrg.id);
	}, [activeOrg, organizations]);

	// Fetch workspaces for current org
	const { data: workspaces = [] } = useSuspenseQuery({
		...trpc.workspace.listByClerkOrgId.queryOptions({
			clerkOrgId: currentOrg?.id ?? "",
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
	});

	// Find current workspace
	const currentWorkspace = useMemo(() => {
		if (!workspaceSlug) return null;
		return workspaces.find((ws) => ws.slug === workspaceSlug);
	}, [workspaceSlug, workspaces]);

	const handleSelectWorkspace = useCallback(
		(workspace: WorkspaceData) => {
			setOpen(false);
			if (currentOrg) {
				router.push(`/org/${currentOrg.slug}/${workspace.slug}`);
			}
		},
		[router, currentOrg],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					role="combobox"
					aria-expanded={open}
					className="justify-between px-2 h-9 hover:bg-accent min-w-0"
				>
					<span className="text-sm font-medium truncate">
						{currentWorkspace?.slug ?? workspaceSlug}
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[280px] p-0 bg-background" align="start">
				<div className="p-2">
					<div className="px-2 py-1.5">
						<p className="text-xs font-medium text-muted-foreground">
							Workspaces
						</p>
					</div>
					<div className="space-y-0.5">
						{workspaces.map((workspace) => (
							<button
								key={workspace.id}
								onClick={() => handleSelectWorkspace(workspace)}
								className={cn(
									"w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/80 transition-colors",
									currentWorkspace?.id === workspace.id && "bg-muted/50",
								)}
							>
								<span className="truncate flex-1 text-left">
									{workspace.slug}
								</span>
								{currentWorkspace?.id === workspace.id && (
									<Check className="h-4 w-4 shrink-0 text-foreground" />
								)}
							</button>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
