"use client";

import { useQuery } from "@tanstack/react-query";
import { Github, GitBranch } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { useTRPC } from "@repo/deus-trpc/react";
import { ConnectRepositoryDialog } from "./connect-repository-dialog";

export function RepositorySettings() {
	const trpc = useTRPC();

	const { data: repositories = [], isLoading } = useQuery({
		...trpc.repository.list.queryOptions({ includeInactive: false }),
	});

	const connectedRepo = repositories[0];

	return (
		<Card className="border-white/10 bg-white/[0.03] backdrop-blur">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-white">
					<GitBranch className="h-5 w-5" />
					GitHub Repository
				</CardTitle>
				<CardDescription>
					Connect your GitHub repository to enable Deus to orchestrate workflows on your codebase.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					</div>
				) : connectedRepo ? (
					<div className="space-y-4">
						<div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
								<Github className="h-5 w-5 text-primary" />
							</div>
							<div className="flex-1">
								<p className="font-medium text-white">
									{connectedRepo.metadata?.fullName ?? "Repository"}
								</p>
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<span>
										Connected{" "}
										{new Date(connectedRepo.connectedAt).toLocaleDateString()}
									</span>
									{connectedRepo.lastSyncedAt && (
										<span>
											Last synced{" "}
											{new Date(
												connectedRepo.lastSyncedAt,
											).toLocaleDateString()}
										</span>
									)}
								</div>
							</div>
						</div>

						{connectedRepo.metadata?.description && (
							<p className="text-sm text-muted-foreground">
								{connectedRepo.metadata.description}
							</p>
						)}

						{connectedRepo.permissions && (
							<div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
								<p className="mb-2 text-xs font-medium text-muted-foreground">
									Permissions
								</p>
								<div className="flex gap-2">
									{connectedRepo.permissions.admin && (
										<span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
											Admin
										</span>
									)}
									{connectedRepo.permissions.push && (
										<span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
											Push
										</span>
									)}
									{connectedRepo.permissions.pull && (
										<span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
											Pull
										</span>
									)}
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.02] py-12">
						<Github className="mb-4 h-12 w-12 text-muted-foreground/60" />
						<p className="mb-2 font-medium text-white">
							No repository connected
						</p>
						<p className="mb-6 text-sm text-muted-foreground">
							Connect a GitHub repository to get started
						</p>
						<ConnectRepositoryDialog>
							<Button className="gap-2">
								<Github className="h-4 w-4" />
								Connect Repository
							</Button>
						</ConnectRepositoryDialog>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
