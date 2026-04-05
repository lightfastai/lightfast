"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Copy, Key, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * Organization API Key List (Client Component)
 *
 * Displays the list of organization API keys with interactive controls:
 * - Create new API keys
 * - Copy API keys to clipboard
 * - Revoke active keys
 * - Rotate keys (revoke old, create new)
 * - Delete keys
 *
 * Uses useSuspenseQuery to consume server-prefetched data without client-side fetch.
 */
export function OrgApiKeyList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Use prefetched data from server (no client-side fetch)
  const { data: apiKeys } = useSuspenseQuery({
    ...trpc.orgApiKeys.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - API keys rarely change
  });

  const createMutation = useMutation(
    trpc.orgApiKeys.create.mutationOptions({
      meta: { errorTitle: "Failed to create API key" },
      onSuccess: (data) => {
        setCreatedKey(data.key);
        setNewKeyName("");
        toast.success("Organization API key created successfully");
        void queryClient.invalidateQueries({
          queryKey: trpc.orgApiKeys.list.queryOptions().queryKey,
        });
      },
    })
  );

  const revokeMutation = useMutation(
    trpc.orgApiKeys.revoke.mutationOptions({
      meta: { errorTitle: "Failed to revoke API key" },
      onSuccess: () => {
        toast.success("API key revoked successfully");
        void queryClient.invalidateQueries({
          queryKey: trpc.orgApiKeys.list.queryOptions().queryKey,
        });
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.orgApiKeys.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete API key" },
      onSuccess: () => {
        toast.success("API key deleted successfully");
        void queryClient.invalidateQueries({
          queryKey: trpc.orgApiKeys.list.queryOptions().queryKey,
        });
      },
    })
  );

  const rotateMutation = useMutation(
    trpc.orgApiKeys.rotate.mutationOptions({
      meta: { errorTitle: "Failed to rotate API key" },
      onSuccess: (data) => {
        setCreatedKey(data.key);
        toast.success("API key rotated successfully");
        void queryClient.invalidateQueries({
          queryKey: trpc.orgApiKeys.list.queryOptions().queryKey,
        });
      },
    })
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
      // biome-ignore lint/suspicious/noAlert: confirm dialog for destructive action
      window.confirm(
        `Are you sure you want to revoke "${keyName}"? This action cannot be undone and any applications using this key will lose access.`
      )
    ) {
      revokeMutation.mutate({ keyId });
    }
  };

  const handleRotate = (keyId: string, keyName: string) => {
    if (
      // biome-ignore lint/suspicious/noAlert: confirm dialog for destructive action
      window.confirm(
        `Are you sure you want to rotate "${keyName}"? The old key will be revoked immediately and a new key will be generated.`
      )
    ) {
      rotateMutation.mutate({ keyId });
    }
  };

  const handleDelete = (keyId: string, keyName: string) => {
    if (
      // biome-ignore lint/suspicious/noAlert: confirm dialog for destructive action
      window.confirm(
        `Are you sure you want to permanently delete "${keyName}"? This action cannot be undone.`
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
          <h2 className="font-semibold text-2xl text-foreground">
            Organization API Keys
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Manage API keys for programmatic access to your organization.
          </p>
        </div>
        <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
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
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="break-all font-mono text-sm">
                      {createdKey}
                    </code>
                    <Button
                      onClick={() => handleCopyKey(createdKey)}
                      size="sm"
                      variant="ghost"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  Make sure to copy your API key now. You won't be able to see
                  it again!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Name</Label>
                  <Input
                    disabled={createMutation.isPending}
                    id="key-name"
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API, Development, CI/CD"
                    value={newKeyName}
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
                    onClick={() => setIsCreateDialogOpen(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={createMutation.isPending}
                    onClick={handleCreateKey}
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
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              key={key.id}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Key className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{key.name}</p>
                    {key.isActive ? (
                      <Badge className="text-xs" variant="default">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="text-xs" variant="secondary">
                        Revoked
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <code className="text-xs">{key.keyPreview}</code>
                    <span>-</span>
                    <span>
                      Created{" "}
                      {formatDistanceToNow(new Date(key.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {key.lastUsedAt && (
                      <>
                        <span>-</span>
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
                        <span>-</span>
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
                  <>
                    <Button
                      disabled={rotateMutation.isPending}
                      onClick={() => handleRotate(key.id, key.name)}
                      size="sm"
                      title="Rotate key"
                      variant="outline"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      disabled={revokeMutation.isPending}
                      onClick={() => handleRevoke(key.id, key.name)}
                      size="sm"
                      variant="outline"
                    >
                      Revoke
                    </Button>
                  </>
                )}
                <Button
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(key.id, key.name)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border border-dashed py-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Key className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              No API keys yet. Create your first organization API key to get
              started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
