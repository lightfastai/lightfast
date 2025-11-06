"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { Key, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useTRPC } from "@repo/console-trpc/react";
import { useToast } from "@repo/ui/hooks/use-toast";

interface GenerateApiKeyDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	organizationId: string;
}

/**
 * Generate API Key Dialog
 *
 * Allows users to create a new API key.
 * All API keys have admin permissions.
 * Shows the generated key ONCE and provides a copy button.
 */
export function GenerateApiKeyDialog({
	open: controlledOpen,
	onOpenChange,
	organizationId,
}: GenerateApiKeyDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const [keyName, setKeyName] = useState("");
	const [generatedKey, setGeneratedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { toast } = useToast();

	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;

	// Generate API key mutation with optimistic updates
	const generateMutation = useMutation(
		trpc.apiKey.generate.mutationOptions({
			onMutate: async () => {
				// Cancel any outgoing refetches
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
					title: "Failed to generate API key",
					description: error.message,
					variant: "destructive",
				});
			},
			onSuccess: (data) => {
				// Store the generated key to display it
				setGeneratedKey(data.key);

				// Get current data
				const previousKeys = queryClient.getQueryData(
					trpc.apiKey.list.queryKey({
						organizationId,
					})
				);

				// Optimistically add to the list
				queryClient.setQueryData(
					trpc.apiKey.list.queryKey({
						organizationId,
					}),
					produce(previousKeys, (draft) => {
						if (draft) {
							draft.unshift({
								id: data.id,
								name: keyName,
								keyPreview: data.preview,
								scopes: ["admin"],
								createdAt: new Date().toISOString(),
								lastUsedAt: null,
								expiresAt: null,
								revokedAt: null,
							});
						}
					})
				);

				toast({
					title: "API key generated",
					description: "Copy your key now. You won't be able to see it again.",
				});
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

	const handleGenerate = () => {
		if (!keyName.trim()) {
			toast({
				title: "Key name required",
				description: "Please provide a name for your API key",
				variant: "destructive",
			});
			return;
		}

		generateMutation.mutate({
			name: keyName.trim(),
			organizationId,
		});
	};

	const handleCopy = async () => {
		if (generatedKey) {
			await navigator.clipboard.writeText(generatedKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleClose = () => {
		// Reset state
		setKeyName("");
		setGeneratedKey(null);
		setCopied(false);
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Key className="h-5 w-5" />
						Generate API Key
					</DialogTitle>
					<DialogDescription>
						{generatedKey
							? "Copy your API key now. You won't be able to see it again."
							: "Create a new API key for CLI authentication. All API keys have admin permissions."}
					</DialogDescription>
				</DialogHeader>

				{generatedKey ? (
					// Success state - show the generated key
					<div className="space-y-4 py-4">
						<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
							<div className="flex items-start gap-3">
								<AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-sm font-medium text-amber-500">
										Save this key now
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										For security reasons, you won't be able to view this key again. If you
										lose it, you'll need to generate a new one.
									</p>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<Label>Your API Key</Label>
							<div className="flex gap-2">
								<Input
									value={generatedKey}
									readOnly
									className="font-mono text-sm"
								/>
								<Button onClick={handleCopy} size="sm" className="gap-2 flex-shrink-0">
									{copied ? (
										<>
											<Check className="h-4 w-4" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy
										</>
									)}
								</Button>
							</div>
						</div>

						<div className="flex justify-end">
							<Button onClick={handleClose}>Close</Button>
						</div>
					</div>
				) : (
					// Input state - configure the key
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="key-name">Key Name</Label>
							<Input
								id="key-name"
								placeholder="e.g., Production CLI, CI/CD Pipeline"
								value={keyName}
								onChange={(e) => setKeyName(e.target.value)}
								disabled={generateMutation.isPending}
							/>
							<p className="text-xs text-muted-foreground">
								A descriptive name to help you identify this key
							</p>
						</div>

						<div className="rounded-lg border border-border/60 bg-muted/10 p-4">
							<div className="space-y-1">
								<p className="text-sm font-medium">Permissions</p>
								<p className="text-xs text-muted-foreground">
									All API keys have admin permissions with full access to your organization.
								</p>
							</div>
						</div>

						<div className="flex gap-2 pt-2">
							<Button
								onClick={handleClose}
								variant="outline"
								className="flex-1"
								disabled={generateMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								onClick={handleGenerate}
								disabled={!keyName.trim() || generateMutation.isPending}
								className="flex-1 gap-2"
							>
								{generateMutation.isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Generating...
									</>
								) : (
									<>
										<Key className="h-4 w-4" />
										Generate API Key
									</>
								)}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
