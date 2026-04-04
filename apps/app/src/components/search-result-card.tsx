"use client";

import type { SearchResult } from "@repo/app-validation";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

// Search result card component with expandable content
export function SearchResultCard({
  result,
  rank: _rank,
  isExpanded,
  onToggleExpand,
}: {
  result: SearchResult;
  rank: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const scorePercent = Math.round(result.score * 100);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(result.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <Collapsible onOpenChange={onToggleExpand} open={isExpanded}>
      <Card className="rounded-md border-border/50 bg-card/40 py-4 backdrop-blur-md transition-colors hover:border-border">
        <CardContent className="px-4">
          <div className="flex items-start gap-4">
            {/* Content */}
            <div className="min-w-0 flex-1 space-y-2">
              {/* Title row with expand trigger */}
              <div className="flex items-start justify-between gap-2">
                <CollapsibleTrigger asChild>
                  <button
                    className="flex items-center gap-1 text-left transition-colors hover:text-primary"
                    type="button"
                  >
                    <h3 className="font-medium text-xs leading-tight">
                      {result.title || "Untitled Document"}
                    </h3>
                  </button>
                </CollapsibleTrigger>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge
                    className="text-xs"
                    variant={
                      scorePercent >= 80
                        ? "default"
                        : scorePercent >= 60
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {scorePercent}%
                  </Badge>
                  {result.source && (
                    <Badge className="text-xs" variant="outline">
                      {result.source}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Snippet (collapsed view) */}
              {!isExpanded && result.snippet && (
                <p className="line-clamp-2 text-muted-foreground text-xs">
                  {result.snippet}
                </p>
              )}

              {/* Type and date */}
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                {result.type && <span>{result.type}</span>}
                {result.occurredAt && (
                  <span>
                    {new Date(result.occurredAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Expanded content */}
              <CollapsibleContent className="space-y-4 pt-2">
                {/* ID and URL */}
                <div className="flex items-center gap-2 text-xs">
                  <Button
                    className="h-6 gap-1 px-2"
                    onClick={handleCopyId}
                    size="sm"
                    variant="ghost"
                  >
                    {copiedId ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span className="font-mono">{result.id}</span>
                  </Button>
                  {result.url && (
                    <a
                      className="flex items-center gap-1 text-primary hover:underline"
                      href={result.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View source
                    </a>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </div>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
