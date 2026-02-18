"use client";

import { FileText, ExternalLink, RefreshCcw, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";


interface RepositoryConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string; // owner/repo
  installationId: number; // GitHub App installation ID
}

async function fetchRepositoryConfig(
  fullName: string,
  installationId: number,
): Promise<{ exists: boolean; path?: string; content?: string }> {
  const url = new URL("/api/github/repository-config", window.location.origin);
  url.searchParams.set("fullName", fullName);
  url.searchParams.set("installationId", String(installationId));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const data = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { exists: boolean; path?: string; content?: string };
}

export function RepositoryConfigDialog({ open, onOpenChange, fullName, installationId }: RepositoryConfigDialogProps) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["repository-config", fullName, installationId],
    queryFn: () => fetchRepositoryConfig(fullName, installationId),
    enabled: open,
  });

  const ghLink = `https://github.com/${fullName}`;
  const filename = data?.path ?? "lightfast.yml";

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

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : "Failed to fetch config"}
          </div>
        )}

        {data && (
          data.exists ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/40">
                <pre className="overflow-x-auto p-4 text-xs">
                  <code>{data.content}</code>
                </pre>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Path: {data.path}</span>
                <a href={`${ghLink}/blob/HEAD/${data.path}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
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
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-1.5">
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

