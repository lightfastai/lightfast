"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/ui/components/ui/command";
import { useSearchSessions } from "~/hooks/sidebar/use-search-sessions";
import { formatDistanceToNow } from "date-fns";
import { MessageSquareIcon } from "lucide-react";

interface SessionSearchDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SessionSearchDialog({
	open,
	onOpenChange,
}: SessionSearchDialogProps) {
	const router = useRouter();
	const {
		searchQuery,
		searchResults,
		handleSearchChange,
		clearSearch,
		isSearchLoading,
		hasResults,
	} = useSearchSessions();

	// Clear search when dialog closes
	useEffect(() => {
		if (!open) {
			clearSearch();
		}
	}, [open, clearSearch]);

	// Handle keyboard shortcuts (Cmd+K will be handled by parent)
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpenChange(!open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [open, onOpenChange]);

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			className="sm:max-w-xl [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:p-0 [&_[cmdk-item]]:rounded-none [&_[cmdk-item]]:px-3 [&_[data-slot=command-input-wrapper]]:h-auto [&_[data-slot=command-input-wrapper]]:py-1 [&_[cmdk-list]]:max-h-[400px]"
			shouldFilter={false}
		>
			<CommandInput
				placeholder="Type to search sessions..."
				value={searchQuery}
				onValueChange={handleSearchChange}
				showSearchIcon={false}
				className="!py-2"
			/>
			<CommandList>
				{isSearchLoading && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						Searching...
					</div>
				)}

				{!isSearchLoading && searchQuery && !hasResults && (
					<CommandEmpty>No sessions found.</CommandEmpty>
				)}

				{!isSearchLoading && hasResults && (
					<CommandGroup>
						{searchResults.map((session) => (
							<CommandItem
								key={session.id}
								value={session.id}
								onSelect={() => {
									onOpenChange(false);
									clearSearch();
									router.push(`/${session.id}`);
								}}
								className="flex items-center gap-3 py-3 cursor-pointer"
							>
								<MessageSquareIcon className="h-4 w-4 text-muted-foreground shrink-0" />
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{session.title}
									</p>
								</div>
								<div className="shrink-0">
									<p className="text-xs text-muted-foreground">
										{formatDistanceToNow(new Date(session.updatedAt), {
											addSuffix: true,
										})}
									</p>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!searchQuery && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						Start typing to search your sessions
					</div>
				)}
			</CommandList>
		</CommandDialog>
	);
}
