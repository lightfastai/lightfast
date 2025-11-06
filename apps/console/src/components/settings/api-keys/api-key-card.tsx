"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { MoreVertical, Trash2, Clock, Calendar } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useTRPC } from "@repo/console-trpc/react";
import { useToast } from "@repo/ui/hooks/use-toast";

interface ApiKeyCardProps {
	apiKey: {
		id: string;
		name: string;
		keyPreview: string;
		scopes: string[];
		createdAt: string;
		lastUsedAt: string | null;
		expiresAt: string | null;
		revokedAt: string | null;
	};
	organizationId: string;
}

export function ApiKeyCard({ apiKey, organizationId }: ApiKeyCardProps) {
	const [showRevokeDialog, setShowRevokeDialog] = useState(false);

	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();

	const isRevoked = !!apiKey.revokedAt;
	const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
	const isActive = !isRevoked && !isExpired;

	// Revoke API key mutation with optimistic updates
	const revokeMutation = useMutation(
		trpc.apiKey.revoke.mutationOptions({
			onMutate: async () => {
				// Cancel outgoing refetches
				await queryClient.cancelQueries({
					queryKey: trpc.apiKey.list.queryKey({
						organizationId,
					}),
				});

				// Snapshot previous value
				const previousKeys = queryClient.getQueryData(
					trpc.apiKey.list.queryKey({
						organizationId,
					})
				);

				// Optimistically update
				queryClient.setQueryData(
					trpc.apiKey.list.queryKey({
						organizationId,
					}),
					produce(previousKeys, (draft) => {
						if (draft) {
							const key = draft.find((k) => k.id === apiKey.id);
							if (key) {
								key.revokedAt = new Date().toISOString();
							}
						}
					})
				);

				return { previousKeys };
			},
			onError: (error, variables, context) => {
				// Rollback on error
				if (context?.previousKeys) {
					queryClient.setQueryData(
						trpc.apiKey.list.queryKey({
							organizationId,
						}),
						context.previousKeys
					);
				}

				toast({
					title: "Failed to revoke API key",
					description: error.message,
					variant: "destructive",
				});
			},
			onSuccess: () => {
				toast({
					title: "API key revoked",
					description: "The API key has been revoked and can no longer be used.",
				});
				setShowRevokeDialog(false);
			},
			onSettled: () => {
				// Invalidate to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: trpc.apiKey.list.queryKey({
						organizationId,
					}),
				});
			},
		})
	);

	const handleRevoke = () => {
		revokeMutation.mutate({ id: apiKey.id });
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const formatRelativeTime = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return "just now";
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
		if (diffInSeconds < 2592000)
			return `${Math.floor(diffInSeconds / 86400)}d ago`;
		return formatDate(dateString);
	};

	return (
		<>
			<div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/5 p-4">
				<div className="flex items-start gap-3 min-w-0 flex-1">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 flex-wrap">
							<p className="text-sm font-medium truncate">{apiKey.name}</p>
							<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
								...{apiKey.keyPreview}
							</span>
							{isActive && (
								<Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
									Active
								</Badge>
							)}
							{isRevoked && (
								<Badge variant="outline" className="text-xs bg-red-500/10 text-red-500 border-red-500/20">
									Revoked
								</Badge>
							)}
							{isExpired && (
								<Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
									Expired
								</Badge>
							)}
						</div>

						<div className="flex items-center gap-3 mt-2 flex-wrap">
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Calendar className="h-3 w-3" />
								<span>Created {formatDate(apiKey.createdAt)}</span>
							</div>
							{apiKey.lastUsedAt && (
								<div className="flex items-center gap-1 text-xs text-muted-foreground">
									<Clock className="h-3 w-3" />
									<span>Last used {formatRelativeTime(apiKey.lastUsedAt)}</span>
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0 ml-4">
					{isActive && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									variant="destructive"
									onClick={() => setShowRevokeDialog(true)}
								>
									<Trash2 className="h-4 w-4" />
									Revoke
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>

			{/* Revoke Confirmation Dialog */}
			<Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Revoke API Key</DialogTitle>
						<DialogDescription>
							Are you sure you want to revoke this API key? This action cannot be
							undone. Any applications using this key will immediately lose access.
						</DialogDescription>
					</DialogHeader>

					<div className="rounded-lg border border-border/60 bg-muted/10 p-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">{apiKey.name}</p>
							<p className="text-xs text-muted-foreground font-mono">
								...{apiKey.keyPreview}
							</p>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowRevokeDialog(false)}
							disabled={revokeMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleRevoke}
							disabled={revokeMutation.isPending}
						>
							{revokeMutation.isPending ? "Revoking..." : "Revoke API Key"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
