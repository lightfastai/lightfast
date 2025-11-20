"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@repo/ui/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/ui/avatar";
/**
 * Organization data from Clerk
 */
interface OrgData {
	id: string; // Clerk org ID
	name: string;
	slug: string;
	role: string;
	imageUrl: string;
}

interface OrgSwitcherProps {
	organizations: OrgData[];
}

export function OrgSwitcher({ organizations }: OrgSwitcherProps) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const { organization: activeOrg } = useOrganization();

	// Find current organization based on Clerk's active org
	const currentOrg = useMemo(() => {
		if (!activeOrg) return null;
		return organizations.find((org) => org.id === activeOrg.id);
	}, [activeOrg, organizations]);

	const handleSelectOrg = useCallback(
		(org: OrgData) => {
			setOpen(false);
			// Navigate to org page - Clerk middleware will set active org from URL
			router.push(`/org/${org.slug}`);
		},
		[router],
	);

	const handleCreateOrg = useCallback(() => {
		setOpen(false);
		router.push("/account/teams/new");
	}, [router]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-48 justify-between px-2"
				>
					<div className="flex items-center gap-2 min-w-0">
						<Avatar className="h-5 w-5 shrink-0">
							{currentOrg?.imageUrl ? (
								<AvatarImage
									src={currentOrg.imageUrl}
									alt={currentOrg.name}
								/>
							) : (
								<AvatarFallback className="text-[10px] bg-muted">
									<Building2 className="h-3 w-3" />
								</AvatarFallback>
							)}
						</Avatar>
						<span className="truncate text-sm">
							{currentOrg?.name ?? "Select team"}
						</span>
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[250px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search organizations..." />
					<CommandList>
						<CommandEmpty>No teams found.</CommandEmpty>
						<CommandGroup>
							{organizations.map((org) => (
								<CommandItem
									key={org.id}
									value={org.slug}
									onSelect={() => handleSelectOrg(org)}
									className="cursor-pointer"
								>
									<div className="flex items-center gap-2 flex-1 min-w-0">
										<Avatar className="h-6 w-6 shrink-0">
											{org.imageUrl ? (
												<AvatarImage
													src={org.imageUrl}
													alt={org.name}
												/>
											) : (
												<AvatarFallback className="text-[10px] bg-muted">
													<Building2 className="h-3 w-3" />
												</AvatarFallback>
											)}
										</Avatar>
										<span className="truncate">
											{org.name}
										</span>
									</div>
									{currentOrg?.id === org.id && (
										<Check className="ml-2 h-4 w-4 shrink-0" />
									)}
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup>
							<CommandItem onSelect={handleCreateOrg} className="cursor-pointer">
								<Plus className="mr-2 h-4 w-4" />
								Create team
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
