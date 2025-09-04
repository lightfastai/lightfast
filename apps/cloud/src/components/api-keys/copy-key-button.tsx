"use client";

import { useState, useCallback } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";

interface CopyKeyButtonProps {
  apiKey: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  showIcon?: boolean;
  className?: string;
}

type CopyState = "idle" | "copying" | "copied" | "error";

export function CopyKeyButton({
  apiKey,
  variant = "default",
  size = "default",
  showIcon = true,
  className,
}: CopyKeyButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copyToClipboard = useCallback(async () => {
    if (!apiKey || copyState === "copying") return;

    setCopyState("copying");

    try {
      // Check if clipboard API is available
      if (!navigator.clipboard) {
        throw new Error("Clipboard API not available");
      }

      await navigator.clipboard.writeText(apiKey);
      setCopyState("copied");
      
      toast.success("API key copied!", {
        description: "The API key has been copied to your clipboard.",
      });

      // Reset state after 2 seconds
      setTimeout(() => {
        setCopyState("idle");
      }, 2000);

    } catch (error) {
      setCopyState("error");
      
      // Fallback: Try using the legacy method
      try {
        const textArea = document.createElement("textarea");
        textArea.value = apiKey;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        if (document.execCommand("copy")) {
          setCopyState("copied");
          toast.success("API key copied!", {
            description: "The API key has been copied to your clipboard.",
          });
          
          setTimeout(() => {
            setCopyState("idle");
          }, 2000);
        } else {
          throw new Error("Failed to copy using fallback method");
        }
        
        document.body.removeChild(textArea);
        
      } catch (fallbackError) {
        toast.error("Copy failed", {
          description: "Unable to copy to clipboard. Please copy the key manually.",
        });
        
        setTimeout(() => {
          setCopyState("idle");
        }, 1000);
      }
    }
  }, [apiKey, copyState]);

  const getButtonContent = () => {
    switch (copyState) {
      case "copying":
        return (
          <>
            {showIcon && <Loader2 className="h-4 w-4 animate-spin" />}
            Copying...
          </>
        );
      case "copied":
        return (
          <>
            {showIcon && <Check className="h-4 w-4" />}
            Copied!
          </>
        );
      case "error":
        return (
          <>
            {showIcon && <Copy className="h-4 w-4" />}
            Copy Failed
          </>
        );
      default:
        return (
          <>
            {showIcon && <Copy className="h-4 w-4" />}
            Copy API Key
          </>
        );
    }
  };

  const isDisabled = copyState === "copying" || !apiKey;

  return (
    <Button
      onClick={copyToClipboard}
      disabled={isDisabled}
      variant={variant}
      size={size}
      className={`gap-2 ${className || ""}`}
      aria-label={copyState === "copied" ? "API key copied" : "Copy API key to clipboard"}
    >
      {getButtonContent()}
    </Button>
  );
}

// Compact version for use in smaller spaces
export function CopyKeyIconButton({
  apiKey,
  className,
}: {
  apiKey: string;
  className?: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copyToClipboard = useCallback(async () => {
    if (!apiKey || copyState === "copying") return;

    setCopyState("copying");

    try {
      await navigator.clipboard.writeText(apiKey);
      setCopyState("copied");
      
      toast.success("Copied!", {
        description: "API key copied to clipboard.",
      });

      setTimeout(() => {
        setCopyState("idle");
      }, 1500);

    } catch (error) {
      setCopyState("error");
      toast.error("Copy failed", {
        description: "Please copy the key manually.",
      });
      
      setTimeout(() => {
        setCopyState("idle");
      }, 1000);
    }
  }, [apiKey, copyState]);

  const getIcon = () => {
    switch (copyState) {
      case "copying":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "copied":
        return <Check className="h-4 w-4" />;
      default:
        return <Copy className="h-4 w-4" />;
    }
  };

  return (
    <Button
      onClick={copyToClipboard}
      disabled={copyState === "copying" || !apiKey}
      variant="outline"
      size="sm"
      className={`p-2 ${className || ""}`}
      aria-label={copyState === "copied" ? "API key copied" : "Copy API key"}
    >
      {getIcon()}
    </Button>
  );
}