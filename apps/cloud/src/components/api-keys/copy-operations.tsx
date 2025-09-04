"use client";

import { Copy, Check, KeyRound, Calendar } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/components/ui/tooltip";

import { useApiKeyActions, type ApiKeyAction } from "~/hooks/use-api-key-actions";

interface CopyOperationsProps {
  apiKey: ApiKeyAction;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default";
  className?: string;
}

/**
 * Component providing various copy operations for API keys with visual feedback
 */
export function CopyOperations({ 
  apiKey, 
  variant = "outline", 
  size = "sm",
  className 
}: CopyOperationsProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const { copyPreview, copyKeyId, copyCreationDate } = useApiKeyActions();

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedItem) {
      const timer = setTimeout(() => setCopiedItem(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedItem]);

  const handleCopyPreview = async () => {
    const result = await copyPreview(apiKey.keyPreview);
    if (result.success) {
      setCopiedItem("preview");
    }
  };

  const handleCopyId = async () => {
    const result = await copyKeyId(apiKey.id);
    if (result.success) {
      setCopiedItem("id");
    }
  };

  const handleCopyCreatedDate = async () => {
    const result = await copyCreationDate(apiKey.createdAt);
    if (result.success) {
      setCopiedItem("date");
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 ${className}`}>
        {/* Copy Preview */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={handleCopyPreview}
              className="h-8 px-2"
            >
              {copiedItem === "preview" ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span className="ml-1 text-xs font-mono">
                {apiKey.keyPreview}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy key preview</p>
          </TooltipContent>
        </Tooltip>

        {/* Copy Key ID */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={handleCopyId}
              className="h-8 px-2"
            >
              {copiedItem === "id" ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <KeyRound className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy key ID</p>
          </TooltipContent>
        </Tooltip>

        {/* Copy Creation Date */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={handleCopyCreatedDate}
              className="h-8 px-2"
            >
              {copiedItem === "date" ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Calendar className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy creation date</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

interface CopyButtonProps {
  text: string;
  description: string;
  icon?: React.ReactNode;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default";
  className?: string;
}

/**
 * Standalone copy button component for individual copy operations
 */
export function CopyButton({ 
  text, 
  description, 
  icon, 
  variant = "outline", 
  size = "sm",
  className 
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = async (text: string, description: string) => {
    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return { success: true };
      }

      // Fallback for older browsers or insecure contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand("copy");
        return { success: true };
      } catch (fallbackError) {
        throw new Error("Copy command failed");
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (error) {
      return { success: false, error: "Copy failed" };
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    const result = await copyToClipboard(text, description);
    if (result.success) {
      setCopied(true);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleCopy}
            className={className}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              icon || <Copy className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : `Copy ${description.toLowerCase()}`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CopyTextProps {
  text: string;
  preview?: string;
  className?: string;
}

/**
 * Inline text component that can be clicked to copy
 */
export function CopyText({ text, preview, className }: CopyTextProps) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = async (text: string, description: string) => {
    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return { success: true };
      }

      // Fallback for older browsers or insecure contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand("copy");
        return { success: true };
      } catch (fallbackError) {
        throw new Error("Copy command failed");
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (error) {
      return { success: false, error: "Copy failed" };
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    const result = await copyToClipboard(text, preview || "text");
    if (result.success) {
      setCopied(true);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 font-mono text-sm hover:bg-muted/50 rounded px-1 transition-colors ${className}`}
          >
            <span>{preview || text}</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : "Click to copy"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}