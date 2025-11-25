"use client";

import { useState } from "react";
import {
	useSuspenseQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { toast } from "sonner";
import { Key, Copy, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * API Key List (Client Component)
 *
 * Displays the list of API keys with interactive controls:
 * - Create new API keys
 * - Copy API keys to clipboard
 * - Revoke active keys
 * - Delete keys
 *
 * Uses useSuspenseQuery to consume server-prefetched data without client-side fetch.
 */
export function ApiKeyList() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [createdKey, setCreatedKey] = useState<string | null>(null);

	// Use prefetched data from server (no client-side fetch)
	const { data: apiKeys } = useSuspenseQuery({
		...trpc.userApiKeys.list.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000, // 5 minutes - API keys rarely change
	});

	const createMutation = useMutation(
		trpc.userApiKeys.create.mutationOptions({
			onSuccess: (data) => {
				setCreatedKey(data.key);
				setNewKeyName("");
				toast.success("API key created successfully");
				void queryClient.invalidateQueries({
					queryKey: trpc.userApiKeys.list.queryOptions().queryKey,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create API key");
			},
		}),
	);

	const revokeMutation = useMutation(
		trpc.userApiKeys.revoke.mutationOptions({
			onSuccess: () => {
				toast.success("API key revoked successfully");
				void queryClient.invalidateQueries({
					queryKey: trpc.userApiKeys.list.queryOptions().queryKey,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to revoke API key");
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.userApiKeys.delete.mutationOptions({
			onSuccess: () => {
				toast.success("API key deleted successfully");
				void queryClient.invalidateQueries({
					queryKey: trpc.userApiKeys.list.queryOptions().queryKey,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to delete API key");
			},
		}),
	);

	const handleCreateKey = () => {
		if (!newKeyName.trim()) {
			toast.error("Please enter a name for the API key");
			return;
		}
		createMutation.mutate({ name: newKeyName.trim() });
	};

	const handleCopyKey = async (key: string) => {
		await navigator.clipboard.writeText(key);
		toast.success("API key copied to clipboard");
	};

	const handleRevoke = (keyId: string, keyName: string) => {
		if (
			window.confirm(
				`Are you sure you want to revoke "${keyName}"? This action cannot be undone and any applications using this key will lose access.`,
			)
		) {
			revokeMutation.mutate({ keyId });
		}
	};

	const handleDelete = (keyId: string, keyName: string) => {
		if (
			window.confirm(
				`Are you sure you want to permanently delete "${keyName}"? This action cannot be undone.`,
			)
		) {
			deleteMutation.mutate({ keyId });
		}
	};

	const handleCloseCreateDialog = () => {
		setIsCreateDialogOpen(false);
		setCreatedKey(null);
		setNewKeyName("");
	};

	return (
		<div className="space-y-8">
			{/* Header with Create Button */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-semibold text-foreground">API Keys</h2>
					<p className="text-sm text-muted-foreground mt-2">
						Manage your API keys for programmatic access to Lightfast.
					</p>
				</div>
				<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							Create API Key
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{createdKey ? "API Key Created" : "Create New API Key"}
							</DialogTitle>
							<DialogDescription>
								{createdKey
									? "Copy your API key now. You won't be able to see it again."
									: "Give your API key a name to help you identify it later."}
							</DialogDescription>
						</DialogHeader>

						{createdKey ? (
							<div className="space-y-4">
								<div className="p-4 bg-muted rounded-lg border border-border">
									<div className="flex items-center justify-between gap-2">
										<code className="text-sm font-mono break-all">
											{createdKey}
										</code>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleCopyKey(createdKey)}
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<p className="text-sm text-muted-foreground">
									⚠️ Make sure to copy your API key now. You won't be able to see
									it again!
								</p>
							</div>
						) : (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="key-name">Name</Label>
									<Input
										id="key-name"
										placeholder="e.g., Production API, Development, CI/CD"
										value={newKeyName}
										onChange={(e) => setNewKeyName(e.target.value)}
										disabled={createMutation.isPending}
									/>
								</div>
							</div>
						)}

						<DialogFooter>
							{createdKey ? (
								<Button onClick={handleCloseCreateDialog}>Done</Button>
							) : (
								<>
									<Button
										variant="outline"
										onClick={() => setIsCreateDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreateKey}
										disabled={createMutation.isPending}
									>
										{createMutation.isPending ? "Creating..." : "Create"}
									</Button>
								</>
							)}
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* API Keys List */}
			{apiKeys.length > 0 ? (
				<div className="space-y-3">
					{apiKeys.map((key) => (
						<div
							key={key.id}
							className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
						>
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
									<Key className="h-5 w-5 text-muted-foreground" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground">{key.name}</p>
										{key.isActive ? (
											<Badge variant="default" className="text-xs">
												Active
											</Badge>
										) : (
											<Badge variant="secondary" className="text-xs">
												Revoked
											</Badge>
										)}
									</div>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<code className="text-xs">••••{key.keyPreview}</code>
										<span>•</span>
										<span>
											Created{" "}
											{formatDistanceToNow(new Date(key.createdAt), {
												addSuffix: true,
											})}
										</span>
										{key.lastUsedAt && (
											<>
												<span>•</span>
												<span>
													Last used{" "}
													{formatDistanceToNow(new Date(key.lastUsedAt), {
														addSuffix: true,
													})}
												</span>
											</>
										)}
										{key.expiresAt && (
											<>
												<span>•</span>
												<span>
													Expires{" "}
													{formatDistanceToNow(new Date(key.expiresAt), {
														addSuffix: true,
													})}
												</span>
											</>
										)}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{key.isActive && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleRevoke(key.id, key.name)}
										disabled={revokeMutation.isPending}
									>
										Revoke
									</Button>
								)}
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleDelete(key.id, key.name)}
									disabled={deleteMutation.isPending}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="text-center py-12 border border-dashed border-border rounded-lg">
					<div className="flex flex-col items-center gap-2">
						<div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted">
							<Key className="h-6 w-6 text-muted-foreground" />
						</div>
						<p className="text-muted-foreground">
							No API keys yet. Create your first API key to get started.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
