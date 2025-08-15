"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/ui/components/ui/command";
import { Icons } from "@repo/ui/components/icons";
import { useSearchSessions } from "~/hooks/sidebar/use-search-sessions";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { groupByDate, DATE_GROUP_ORDER } from "~/lib/date";
import type { DateGroup } from "~/lib/date";
import { usePinnedSessions } from "~/hooks/sidebar/use-pinned-sessions";

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

	// Fetch pinned sessions using the dedicated hook
	const { data: pinnedSessions = [] } = usePinnedSessions();

	// Group pinned sessions by date
	const groupedPinnedSessions = useMemo(() => {
		if (!pinnedSessions || pinnedSessions.length === 0) return null;

		const sessionsWithDates = pinnedSessions.map((session) => ({
			...session,
			createdAt: new Date(session.createdAt),
		}));
		const grouped = groupByDate(sessionsWithDates);

		// Convert back to original Session type with string dates
		const result: Record<DateGroup, typeof pinnedSessions> = {} as Record<
			DateGroup,
			typeof pinnedSessions
		>;
		Object.entries(grouped).forEach(([category, sessionArray]) => {
			result[category as DateGroup] = sessionArray.map((session) => ({
				...session,
				createdAt: session.createdAt.toISOString(),
			}));
		});
		return result;
	}, [pinnedSessions]);

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
			className="sm:max-w-xl [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:p-0 [&_[cmdk-item]]:px-3 [&_[data-slot=command-input-wrapper]]:h-auto [&_[data-slot=command-input-wrapper]]:py-1 [&_[cmdk-list]]:max-h-[400px]"
			shouldFilter={false}
		>
			<CommandInput
				placeholder="Search chats..."
				value={searchQuery}
				onValueChange={handleSearchChange}
				showSearchIcon={false}
				className="!py-2"
			/>
			<CommandList>
				<div className="px-2 py-2">
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
									className="flex items-center gap-3 py-2 cursor-pointer"
								>
									<MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
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

					{!isSearchLoading && !searchQuery && (
						<>
							{/* New Chat option */}
							<CommandGroup>
								<CommandItem
									value="new-chat"
									onSelect={() => {
										onOpenChange(false);
										router.push("/new");
									}}
									className="flex items-center gap-3 py-2 cursor-pointer"
								>
									<Icons.newChat className="h-4 w-4 text-muted-foreground shrink-0" />
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium">New chat</p>
									</div>
								</CommandItem>
							</CommandGroup>

							{/* Pinned sessions grouped by date */}
							{groupedPinnedSessions &&
								DATE_GROUP_ORDER.map((category) => {
									const categorySessions = groupedPinnedSessions[category];
									if (!categorySessions || categorySessions.length === 0)
										return null;

									return (
										<CommandGroup key={category} heading={category}>
											{categorySessions.map((session) => (
												<CommandItem
													key={session.id}
													value={session.id}
													onSelect={() => {
														onOpenChange(false);
														router.push(`/${session.id}`);
													}}
													className="flex items-center gap-3 py-2 cursor-pointer"
												>
													<MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium truncate">
															{session.title}
														</p>
													</div>
												</CommandItem>
											))}
										</CommandGroup>
									);
								})}
						</>
					)}
				</div>
			</CommandList>
		</CommandDialog>
	);
}
