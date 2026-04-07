"use client";

import { useTRPC } from "@repo/app-trpc/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Copy,
  Key,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";

export function OrgApiKeyList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryKey = trpc.orgApiKeys.list.queryOptions().queryKey;

  const { data: keys } = useSuspenseQuery({
    ...trpc.orgApiKeys.list.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Alert dialog state
  const [alertAction, setAlertAction] = useState<{
    type: "revoke" | "rotate" | "delete";
    keyId: string;
    keyName: string;
  } | null>(null);

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: listQueryKey }),
    [queryClient, listQueryKey]
  );

  // --- Mutations ---

  const createMutation = useMutation(
    trpc.orgApiKeys.create.mutationOptions({
      meta: { errorTitle: "Failed to create API key" },
      onSuccess: (data) => {
        setCreatedKey(data.key);
        setNewKeyName("");
        void invalidateList();
      },
    })
  );

  const revokeMutation = useMutation(
    trpc.orgApiKeys.revoke.mutationOptions({
      meta: { errorTitle: "Failed to revoke API key" },
      onSuccess: () => toast.success("API key revoked"),
      onSettled: () => void invalidateList(),
    })
  );

  const rotateMutation = useMutation(
    trpc.orgApiKeys.rotate.mutationOptions({
      meta: { errorTitle: "Failed to rotate API key" },
      onSuccess: (data) => {
        setCreatedKey(data.key);
        setIsCreateOpen(true);
        toast.success("API key rotated — copy your new key");
      },
      onSettled: () => void invalidateList(),
    })
  );

  const deleteMutation = useMutation(
    trpc.orgApiKeys.delete.mutationOptions({
      meta: { errorTitle: "Failed to delete API key" },
      onSuccess: () => toast.success("API key deleted"),
      onSettled: () => void invalidateList(),
    })
  );

  // --- Handlers ---

  function handleCreate() {
    if (!newKeyName.trim()) {
      return;
    }
    createMutation.mutate({ name: newKeyName.trim() });
  }

  function handleConfirmAlert() {
    if (!alertAction) {
      return;
    }
    switch (alertAction.type) {
      case "revoke":
        revokeMutation.mutate({ keyId: alertAction.keyId });
        break;
      case "rotate":
        rotateMutation.mutate({ keyId: alertAction.keyId });
        break;
      case "delete":
        deleteMutation.mutate({ keyId: alertAction.keyId });
        break;
      default:
        break;
    }
    setAlertAction(null);
  }

  function handleCopy() {
    if (!createdKey) {
      return;
    }
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDialogClose(open: boolean) {
    if (open) {
      setIsCreateOpen(true);
    } else {
      setIsCreateOpen(false);
      setCreatedKey(null);
      setNewKeyName("");
      setCopied(false);
      createMutation.reset();
    }
  }

  // --- Render ---

  return (
    <>
      {/* Header + Create Button */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {keys.length} {keys.length === 1 ? "key" : "keys"}
        </p>
        <Dialog onOpenChange={handleDialogClose} open={isCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <Plus className="mr-1.5 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdKey ? "Copy Your API Key" : "Create API Key"}
              </DialogTitle>
              <DialogDescription>
                {createdKey
                  ? "This key will only be shown once. Copy it now and store it securely."
                  : "Give your key a descriptive name to identify its purpose."}
              </DialogDescription>
            </DialogHeader>

            {createdKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <code className="flex-1 break-all font-mono text-sm">
                    {createdKey}
                  </code>
                  <Button
                    className="h-8 w-8 shrink-0"
                    onClick={handleCopy}
                    size="icon"
                    variant="ghost"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  autoFocus
                  maxLength={100}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="e.g. Production API, CI/CD Pipeline"
                  value={newKeyName}
                />
                <DialogFooter>
                  <Button
                    disabled={!newKeyName.trim() || createMutation.isPending}
                    onClick={handleCreate}
                    variant="secondary"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Key List */}
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted/20 p-3">
            <Key className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-sm">No API keys yet</p>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm">
            Create an API key to access your organization's resources
            programmatically.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          {keys.map((key) => {
            const isPending =
              (revokeMutation.isPending &&
                revokeMutation.variables?.keyId === key.id) ||
              (deleteMutation.isPending &&
                deleteMutation.variables?.keyId === key.id) ||
              (rotateMutation.isPending &&
                rotateMutation.variables?.keyId === key.id);

            return (
              <div
                className={`flex items-center justify-between border-border/60 border-b px-4 py-4 last:border-b-0 ${
                  isPending ? "opacity-60" : ""
                } ${key.isActive ? "" : "opacity-50"}`}
                key={key.id}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{key.name}</p>
                    {!key.isActive && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <code className="font-mono">{key.keyPreview}</code>
                    <span>
                      Created{" "}
                      {formatDistanceToNow(new Date(key.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {key.lastUsedAt && (
                      <span>
                        Last used{" "}
                        {formatDistanceToNow(new Date(key.lastUsedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                    {key.expiresAt && (
                      <span>
                        Expires{" "}
                        {formatDistanceToNow(new Date(key.expiresAt), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-8 w-8 shrink-0 p-0"
                      onClick={(e) => e.stopPropagation()}
                      size="sm"
                      variant="ghost"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {key.isActive && (
                      <>
                        <DropdownMenuItem
                          onClick={() =>
                            setAlertAction({
                              type: "rotate",
                              keyId: key.id,
                              keyName: key.name,
                            })
                          }
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Rotate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setAlertAction({
                              type: "revoke",
                              keyId: key.id,
                              keyName: key.name,
                            })
                          }
                        >
                          <ShieldOff className="mr-2 h-4 w-4" />
                          Revoke
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        setAlertAction({
                          type: "delete",
                          keyId: key.id,
                          keyName: key.name,
                        })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation AlertDialog */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setAlertAction(null);
          }
        }}
        open={!!alertAction}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertAction?.type === "revoke" && "Revoke API Key?"}
              {alertAction?.type === "rotate" && "Rotate API Key?"}
              {alertAction?.type === "delete" && "Delete API Key?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction?.type === "revoke" &&
                `"${alertAction.keyName}" will be deactivated immediately. Any requests using this key will fail.`}
              {alertAction?.type === "rotate" &&
                `"${alertAction.keyName}" will be revoked and replaced with a new key. Update your integrations with the new key.`}
              {alertAction?.type === "delete" &&
                `"${alertAction.keyName}" will be permanently deleted. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                alertAction?.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={handleConfirmAlert}
            >
              {alertAction?.type === "revoke" && "Revoke"}
              {alertAction?.type === "rotate" && "Rotate"}
              {alertAction?.type === "delete" && "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
