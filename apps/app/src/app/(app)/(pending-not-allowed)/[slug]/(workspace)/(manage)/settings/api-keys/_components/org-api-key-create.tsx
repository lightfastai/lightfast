"use client";

import { useTRPC } from "@repo/app-trpc/react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";

export function OrgApiKeyCreate() {
  const { has, isLoaded } = useAuth();
  const canManageApiKeys = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryKey =
    trpc.org.settings.orgApiKeys.list.queryOptions().queryKey;

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Guards onSuccess against re-populating a stale secret after the dialog
  // has been closed (and createMutation.reset() called) but before the
  // in-flight mutation resolved.
  const isOpenRef = useRef(false);

  const createMutation = useMutation(
    trpc.org.settings.orgApiKeys.create.mutationOptions({
      meta: { errorTitle: "Failed to create API key" },
      onSuccess: (data) => {
        if (!isOpenRef.current) {
          return;
        }
        if (data.key) {
          setCreatedKey(data.key);
        }
        setName("");
        void queryClient.invalidateQueries({ queryKey: listQueryKey });
      },
    })
  );

  if (!canManageApiKeys) {
    return null;
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || createMutation.isPending) {
      return;
    }
    createMutation.mutate({ name: trimmed });
  }

  function handleCopy() {
    if (!createdKey) {
      return;
    }
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(open: boolean) {
    isOpenRef.current = open;
    if (open) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setCreatedKey(null);
      setName("");
      setCopied(false);
      createMutation.reset();
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
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
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="e.g. Production API, CI/CD Pipeline"
              value={name}
            />
            <DialogFooter>
              <Button
                disabled={!name.trim() || createMutation.isPending}
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
  );
}
