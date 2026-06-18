import { useAuth } from "@clerk/tanstack-react-start";
import {
  Tick02Icon as Check,
  Copy01Icon as Copy,
  Loading03Icon as Loader2,
  Add01Icon as Plus,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { useCallback, useRef, useState } from "react";
import { useOrgApiKeyCreateAction } from "./org-api-key-create-action";

export function OrgApiKeyCreate() {
  const { has, isLoaded } = useAuth();
  const canManageApiKeys = isLoaded && !!has?.({ role: "org:admin" });

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Guards onSuccess against re-populating a stale secret after the dialog
  // has been closed (and createMutation.reset() called) but before the
  // in-flight mutation resolved.
  const isOpenRef = useRef(false);

  const handleCreated = useCallback((key: string | null) => {
    if (!isOpenRef.current) {
      return;
    }
    if (key) {
      setCreatedKey(key);
    }
    setName("");
  }, []);

  const createMutation = useOrgApiKeyCreateAction({
    onCreated: handleCreated,
  });

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || createMutation.isPending) {
      return;
    }
    createMutation.mutate({ name: trimmed });
  }, [createMutation.isPending, createMutation.mutate, name]);

  const handleCopy = useCallback(() => {
    if (!createdKey) {
      return;
    }
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [createdKey]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
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
    },
    [createMutation.reset]
  );

  if (!canManageApiKeys) {
    return null;
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <HugeiconsIcon className="mr-1.5 h-4 w-4" icon={Plus} />
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
                  <HugeiconsIcon
                    className="h-4 w-4 text-green-500"
                    icon={Check}
                  />
                ) : (
                  <HugeiconsIcon className="h-4 w-4" icon={Copy} />
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
                    <HugeiconsIcon
                      className="mr-1.5 h-4 w-4 animate-spin"
                      icon={Loader2}
                    />
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
