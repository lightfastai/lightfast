"use client";

import { useEffect, useState } from "react";
import { FileText, ExternalLink, RefreshCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";

interface RepositoryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string; // owner/repo
  installationId: number; // GitHub App installation ID
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; exists: boolean; path?: string; content?: string }
  | { status: "error"; message: string };

export function RepositoryConfigDialog({ open, onOpenChange, fullName, installationId }: RepositoryConfigDialogProps) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function fetchConfig() {
    try {
      setState({ status: "loading" });
      const url = new URL("/api/github/repository-config", window.location.origin);
      url.searchParams.set("fullName", fullName);
      url.searchParams.set("installationId", String(installationId));
      const res = await fetch(url.toString());
      if (!res.ok) {
        const data = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { exists: boolean; path?: string; content?: string };
      setState({ status: "loaded", exists: data.exists, path: data.path, content: data.content });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch config";
      setState({ status: "error", message });
      toast.error("Failed to load config", { description: message });
    }
  }

  useEffect(() => {
    if (open) void fetchConfig();
    // Note: fetchConfig is not in deps because it's defined in component scope
    // and changes on every render. We only want to fetch when these values change.
  }, [open, fullName, installationId]);

  const ghLink = `https://github.com/${fullName}`;
  const filename = state.status === "loaded" && state.path ? state.path : "lightfast.yml";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Repository Configuration
          </DialogTitle>
          <DialogDescription>
            {fullName} · {filename}
          </DialogDescription>
        </DialogHeader>

        {state.status === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            {state.message}
          </div>
        )}

        {state.status === "loaded" && (
          state.exists ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40">
                <pre className="overflow-x-auto p-4 text-xs">
                  <code>{state.content}</code>
                </pre>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Path: {state.path}</span>
                <a href={`${ghLink}/blob/HEAD/${state.path}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Open on GitHub
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
              No configuration file found. Add <code className="rounded bg-muted px-1">lightfast.yml</code> and push to the default branch.
            </div>
          )
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => void fetchConfig()} className="gap-1.5">
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={ghLink} target="_blank" rel="noopener noreferrer" className="gap-1.5 inline-flex items-center">
              <ExternalLink className="h-3.5 w-3.5" /> Repository
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

