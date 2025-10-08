"use client";

import { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
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
import type { Organization } from "@db/deus/schema";

interface OrgSwitcherProps {
	organizations: Organization[];
	currentOrgId?: number;
}

export function OrgSwitcher({ organizations, currentOrgId }: OrgSwitcherProps) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const params = useParams();

	// Find current organization
	const currentOrg = useMemo(() => {
		const orgIdFromParams = params.orgId ? Number(params.orgId) : currentOrgId;
		return organizations.find((org) => org.githubOrgId === orgIdFromParams);
	}, [organizations, currentOrgId, params.orgId]);

	const handleSelectOrg = (org: Organization) => {
		setOpen(false);
		router.push(`/org/${org.githubOrgId}`);
	};

	const handleClaimOrg = () => {
		setOpen(false);
		router.push("/onboarding/claim-org");
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					role="combobox"
					aria-expanded={open}
					className="w-48 justify-between px-2"
				>
					<div className="flex items-center gap-2 min-w-0">
						<Avatar className="h-5 w-5 shrink-0">
							{currentOrg?.githubOrgAvatarUrl ? (
								<AvatarImage
									src={currentOrg.githubOrgAvatarUrl}
									alt={currentOrg.githubOrgName}
								/>
							) : (
								<AvatarFallback className="text-[10px] bg-muted">
									<Building2 className="h-3 w-3" />
								</AvatarFallback>
							)}
						</Avatar>
						<span className="truncate text-sm">
							{currentOrg?.githubOrgName ?? "Select organization"}
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
							{organizations.map((org) => (
								<CommandItem
									key={org.id}
									value={org.githubOrgSlug}
									onSelect={() => handleSelectOrg(org)}
									className="cursor-pointer"
								>
									<div className="flex items-center gap-2 flex-1 min-w-0">
										<Avatar className="h-6 w-6 shrink-0">
											{org.githubOrgAvatarUrl ? (
												<AvatarImage
													src={org.githubOrgAvatarUrl}
													alt={org.githubOrgName}
												/>
											) : (
												<AvatarFallback className="text-[10px] bg-muted">
													<Building2 className="h-3 w-3" />
												</AvatarFallback>
											)}
										</Avatar>
										<span className="truncate">{org.githubOrgName}</span>
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
