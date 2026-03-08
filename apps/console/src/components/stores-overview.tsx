"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Database, FileText, Settings } from "lucide-react";
import { useState } from "react";
import type { Store } from "~/types";

interface StoreOverviewProps {
  store: Store | null;
}

/**
 * Store Overview Component
 *
 * Displays the workspace's single store (1:1 relationship).
 * Each workspace has exactly one store.
 */
export function StoreOverview({ store }: StoreOverviewProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!store) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="font-medium text-base">
                Vector Store
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                Store will be created when you connect a source
              </p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No store configured yet</p>
            <p className="mt-1 text-xs">
              Connect a repository to automatically create a vector store
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="font-medium text-base">
                Vector Store
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                Workspace knowledge storage
              </p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <button
            className="w-full"
            onClick={() => setShowDetails(true)}
            type="button"
          >
            <div className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="truncate font-medium text-sm">
                      {store.embeddingModel}
                    </p>
                    <Badge className="shrink-0 text-xs" variant="secondary">
                      {store.embeddingDim}d
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {store.documentCount.toLocaleString()}{" "}
                      {store.documentCount === 1 ? "doc" : "docs"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setShowDetails} open={showDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Store Configuration</DialogTitle>
            <DialogDescription>
              Vector store details and configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Embedding Model
                </p>
                <p className="font-mono text-sm">{store.embeddingModel}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Embedding Dimension
                </p>
                <p className="text-sm">{store.embeddingDim}d</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Pinecone Index
                </p>
                <p className="break-all font-mono text-sm">{store.indexName}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Namespace
                </p>
                <p className="break-all font-mono text-sm">
                  {store.namespaceName}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Document Count
                </p>
                <p className="text-sm">
                  {store.documentCount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Chunking
                </p>
                <p className="text-sm">
                  {store.chunkMaxTokens} tokens, {store.chunkOverlap} overlap
                </p>
              </div>
              <div className="col-span-2 space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  Created
                </p>
                <p className="text-sm">
                  {new Date(store.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-muted p-4">
              <p className="font-medium text-sm">lightfast.yml Configuration</p>
              <pre className="overflow-auto rounded border bg-background p-3 text-xs">
                {`version: 1
embedding:
  dimension: ${store.embeddingDim}
  model: ${store.embeddingModel}

chunking:
  maxTokens: ${store.chunkMaxTokens}
  overlap: ${store.chunkOverlap}

include:
  - docs/**/*.md
  - docs/**/*.mdx

exclude:
  - node_modules
  - .git`}
              </pre>
              <p className="text-muted-foreground text-xs">
                This is an example configuration. Actual config is determined by
                connected repositories.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Keep backward compatibility alias
export { StoreOverview as StoresOverview };
