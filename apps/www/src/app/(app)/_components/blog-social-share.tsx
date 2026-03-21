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
        onClick={() => window.open(shareLinks.twitter, "_blank")}
        size="sm"
        variant="ghost"
      >
        <Twitter className="h-4 w-4" />
      </Button>

      <Button
        aria-label="Share on LinkedIn"
        onClick={() => window.open(shareLinks.linkedin, "_blank")}
        size="sm"
        variant="ghost"
      >
        <Linkedin className="h-4 w-4" />
      </Button>

      <Button
        aria-label="Copy link"
        onClick={handleCopyLink}
        size="sm"
        variant="ghost"
      >
        <Link2 className="h-4 w-4" />
        {copied && <span className="ml-2 text-green-600 text-xs">Copied!</span>}
      </Button>
    </div>
  );
}
