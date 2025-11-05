"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Key, Plus } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { GenerateApiKeyDialog } from "./generate-api-key-dialog";
import { ApiKeyCard } from "./api-key-card";
import { useTRPC } from "@repo/deus-trpc/react";

interface ApiKeysSettingsProps {
	organizationId: string;
}

export function ApiKeysSettings({ organizationId }: ApiKeysSettingsProps) {
	const [showGenerateDialog, setShowGenerateDialog] = useState(false);
	const trpc = useTRPC();

	// Query to fetch organization's API keys
	// Using useSuspenseQuery for better loading UX with Suspense boundaries
	const { data: apiKeys = [] } = useSuspenseQuery({
		...trpc.apiKey.list.queryOptions({
			organizationId,
		}),
		refetchOnMount: false, // Use prefetched server data
		refetchOnWindowFocus: false, // Don't refetch on window focus
		staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
	});

	const hasApiKeys = apiKeys.length > 0;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Key className="h-5 w-5" />
								API Keys
							</CardTitle>
							<CardDescription>
								Manage API keys for CLI authentication and programmatic access
							</CardDescription>
						</div>
						{hasApiKeys && (
							<Button
								onClick={() => setShowGenerateDialog(true)}
								size="sm"
								className="gap-2"
							>
								<Plus className="h-4 w-4" />
								Generate new key
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{hasApiKeys ? (
						<div className="space-y-3">
							{apiKeys.map((apiKey) => (
								<ApiKeyCard key={apiKey.id} apiKey={apiKey} organizationId={organizationId} />
							))}
						</div>
					) : (
						<div className="py-12">
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8">
								<div className="flex flex-col items-center text-center">
									<Key className="h-12 w-12 text-muted-foreground/60" />
									<p className="mt-3 text-sm font-medium">No API keys created</p>
									<p className="mt-1 text-xs text-muted-foreground max-w-sm">
										Generate an API key to authenticate with the Deus CLI and access the
										API programmatically
									</p>
									<Button
										onClick={() => setShowGenerateDialog(true)}
										className="mt-4 gap-2"
									>
										<Plus className="h-4 w-4" />
										Generate your first API key
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<GenerateApiKeyDialog
				open={showGenerateDialog}
				onOpenChange={setShowGenerateDialog}
				organizationId={organizationId}
			/>
		</div>
	);
}
