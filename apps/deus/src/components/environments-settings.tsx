"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { ConnectRepositoryDialog } from "./connect-repository-dialog";
import { useTRPC } from "@repo/deus-trpc/react";

export function EnvironmentsSettings() {
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const trpc = useTRPC();

	// Query to check if user has connected repositories
	const { data: repositories = [], isLoading } = useQuery({
		...trpc.repository.list.queryOptions({ includeInactive: false }),
	});

	const hasEnvironments = repositories.length > 0;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<SettingsIcon className="h-5 w-5" />
								Repository Environments
							</CardTitle>
							<CardDescription>
								Create and manage environments for your GitHub repositories
							</CardDescription>
						</div>
						{hasEnvironments && (
							<Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
								<Plus className="h-4 w-4" />
								Create environment
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="py-8 text-center">
							<p className="text-sm text-muted-foreground">Loading environments...</p>
						</div>
					) : hasEnvironments ? (
						<div className="space-y-4">
							{repositories.map((repo) => (
								<div
									key={repo.id}
									className="flex items-center justify-between rounded-lg border border-border/60 p-4"
								>
									<div>
										<p className="text-sm font-medium">{repo.metadata?.fullName}</p>
										<p className="text-xs text-muted-foreground">
											{repo.metadata?.description ?? "No description"}
										</p>
									</div>
									<Button variant="outline" size="sm">
										Configure
									</Button>
								</div>
							))}
						</div>
					) : (
						<div className="py-8">
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8">
								<div className="flex flex-col items-center text-center">
									<SettingsIcon className="h-12 w-12 text-muted-foreground/60" />
									<p className="mt-3 text-sm font-medium">
										No environments yet
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Create your first environment to get started
									</p>
									<Button
										onClick={() => setShowCreateDialog(true)}
										className="mt-4 gap-2"
									>
										<Plus className="h-4 w-4" />
										Create your first environment
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<ConnectRepositoryDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</div>
	);
}
