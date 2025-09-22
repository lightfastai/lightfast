"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/ui/tooltip";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@repo/chat-trpc/react";

const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractSessionId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 1) {
    return null;
  }

  const [candidate] = segments;

  if (!candidate) {
    return null;
  }

  if (candidate === "new" || candidate === "billing" || candidate === "share") {
    return null;
  }

  if (!SESSION_ID_REGEX.test(candidate)) {
    return null;
  }

  return candidate;
}

export function ShareSessionButton() {
  const pathname = usePathname();
  const trpc = useTRPC();

  const sessionId = useMemo(() => extractSessionId(pathname), [pathname]);

  const shareMutation = useMutation(
    trpc.share.create.mutationOptions({
      onError: (error) => {
        toast.error("Couldn't create share link", {
          description: error.message || "Please try again in a moment.",
        });
      },
    }),
  );

  const handleShare = async () => {
    if (!sessionId || shareMutation.isPending) {
      return;
    }

    try {
      const result = await shareMutation.mutateAsync({ sessionId });
      const shareUrl = `${window.location.origin}/share/${result.shareId}`;

      let copied = false;
      try {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } catch (error) {
        console.warn("[ShareSessionButton] Failed to copy share link", error);
      }

      if (!copied) {
        window.prompt("Share this link", shareUrl);
      }

      toast.success(copied ? "Share link copied" : "Share link ready", {
        description: shareUrl,
      });
    } catch (error) {
      console.error("[ShareSessionButton] Failed to create share link", error);
      // Error toast handled in onError above when available
      if (!(error instanceof Error)) {
        toast.error("Couldn't create share link");
      }
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className="hover:bg-muted gap-1.5 px-2 py-1 h-8"
          aria-label="Share conversation"
          onClick={handleShare}
          disabled={shareMutation.isPending}
        >
          {shareMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">Share</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        Share conversation
      </TooltipContent>
    </Tooltip>
  );
}
