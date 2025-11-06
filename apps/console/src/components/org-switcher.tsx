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
import type { organizations } from "@db/console/schema";

/**
 * Organization data from getUserOrganizations()
 */
interface OrgData {
	id: string; // Clerk org ID
	name: string;
	slug: string;
	role: string;
	deusOrg: typeof organizations.$inferSelect | null;
}

interface OrgSwitcherProps {
	organizations: OrgData[];
}

export function OrgSwitcher({ organizations }: OrgSwitcherProps) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const { organization: activeOrg } = useOrganization();

	// Filter to only show organizations that have been claimed in Console
	const claimedOrgs = useMemo(() => {
		return organizations.filter((org) => org.deusOrg !== null);
	}, [organizations]);

	// Find current organization based on Clerk's active org
	const currentOrg = useMemo(() => {
		if (!activeOrg) return null;
		return claimedOrgs.find((org) => org.id === activeOrg.id);
	}, [activeOrg, claimedOrgs]);

	const handleSelectOrg = useCallback(
		(org: OrgData) => {
			setOpen(false);

			// Guard against unclaimed orgs (should not happen with filtering)
			if (!org.deusOrg) {
				console.error("Cannot switch to unclaimed organization");
				return;
			}

			// Navigate to org page - Clerk middleware will set active org from URL
			router.push(`/org/${org.slug}`);
		},
		[router],
	);

	const handleClaimOrg = useCallback(() => {
		setOpen(false);
		router.push("/onboarding/claim-org");
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
							{currentOrg?.deusOrg?.githubOrgAvatarUrl ? (
								<AvatarImage
									src={currentOrg.deusOrg.githubOrgAvatarUrl}
									alt={currentOrg.deusOrg.githubOrgName}
								/>
							) : (
								<AvatarFallback className="text-[10px] bg-muted">
									<Building2 className="h-3 w-3" />
								</AvatarFallback>
							)}
						</Avatar>
						<span className="truncate text-sm">
							{currentOrg?.deusOrg?.githubOrgName ?? "Select organization"}
						</span>
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[250px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search organizations..." />
					<CommandList>
						<CommandEmpty>No organizations found.</CommandEmpty>
						<CommandGroup>
							{claimedOrgs.map((org) => (
								<CommandItem
									key={org.id}
									value={org.deusOrg?.githubOrgSlug ?? org.slug}
									onSelect={() => handleSelectOrg(org)}
									className="cursor-pointer"
								>
									<div className="flex items-center gap-2 flex-1 min-w-0">
										<Avatar className="h-6 w-6 shrink-0">
											{org.deusOrg?.githubOrgAvatarUrl ? (
												<AvatarImage
													src={org.deusOrg.githubOrgAvatarUrl}
													alt={org.deusOrg.githubOrgName}
												/>
											) : (
												<AvatarFallback className="text-[10px] bg-muted">
													<Building2 className="h-3 w-3" />
												</AvatarFallback>
											)}
										</Avatar>
										<span className="truncate">
											{org.deusOrg?.githubOrgName ?? org.name}
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
							<CommandItem onSelect={handleClaimOrg} className="cursor-pointer">
								<Plus className="mr-2 h-4 w-4" />
								Claim organization
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
