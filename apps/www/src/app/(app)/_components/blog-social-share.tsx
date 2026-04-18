"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Link2, Linkedin, Twitter } from "lucide-react";
import { useState } from "react";

interface SocialShareProps {
  description?: string;
  title: string;
  url: string;
}

export function SocialShare({
  title,
  url,
  description: _description,
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      title
    )}&url=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      url
    )}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">Share:</span>

      <Button
        aria-label="Share on Twitter"
        className="h-6 w-6"
        onClick={() => window.open(shareLinks.twitter, "_blank")}
        size="icon"
        variant="ghost"
      >
        <Twitter className="size-3.5" />
      </Button>

      <Button
        aria-label="Share on LinkedIn"
        className="h-6 w-6"
        onClick={() => window.open(shareLinks.linkedin, "_blank")}
        size="icon"
        variant="ghost"
      >
        <Linkedin className="size-3.5" />
      </Button>

      <Button
        aria-label="Copy link"
        className="h-6 w-6"
        onClick={handleCopyLink}
        size="icon"
        variant="ghost"
      >
        <Link2 className="size-3.5" />
        {copied && <span className="ml-2 text-green-600 text-xs">Copied!</span>}
      </Button>
    </div>
  );
}
