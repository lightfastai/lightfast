"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { CopyKeyButton } from "./copy-key-button";
import { Button } from "@repo/ui/components/ui/button";

interface KeyDisplayProps {
  apiKey: string;
  keyName: string;
  keyId: string;
  expiresAt: Date | null;
  createdAt: Date;
  onKeyCopied?: () => void;
}

export function KeyDisplay({
  apiKey,
  keyName,
  keyId,
  expiresAt,
  createdAt,
  onKeyCopied,
}: KeyDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Format the API key for display (add spaces for readability)
  const formatApiKey = (key: string) => {
    return key.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const handleKeyCopied = () => {
    onKeyCopied?.();
  };

  return (
    <div className="space-y-4">
      {/* API Key Display */}
      <div className="relative">
        <div className="bg-muted/50 border rounded-lg p-4 font-mono text-sm">
          {isVisible ? (
            <div className="break-all select-all">
              {formatApiKey(apiKey)}
            </div>
          ) : (
            <div className="text-muted-foreground">
              {"●".repeat(48)} (Click show to reveal)
            </div>
          )}
        </div>
        
        {/* Visibility toggle */}
        <Button
          onClick={handleToggleVisibility}
          variant="outline"
          size="sm"
          className="absolute top-2 right-2"
          aria-label={isVisible ? "Hide API key" : "Show API key"}
        >
          {isVisible ? (
            <>
              <EyeOff className="h-3 w-3 mr-1" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-1" />
              Show
            </>
          )}
        </Button>
      </div>

      {/* Copy button */}
      <div className="flex justify-center">
        <CopyKeyButton
          apiKey={apiKey}
          size="lg"
          className="min-w-[150px]"
          onCopy={handleKeyCopied}
        />
      </div>
    </div>
  );
}