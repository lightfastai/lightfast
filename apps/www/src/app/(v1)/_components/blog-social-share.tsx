"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Link2 } from "lucide-react";
import type { SVGProps } from "react";
import { useState } from "react";

function TwitterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
    </svg>
  );
}

function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

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
        <TwitterIcon className="size-3.5" />
      </Button>

      <Button
        aria-label="Share on LinkedIn"
        className="h-6 w-6"
        onClick={() => window.open(shareLinks.linkedin, "_blank")}
        size="icon"
        variant="ghost"
      >
        <LinkedinIcon className="size-3.5" />
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
