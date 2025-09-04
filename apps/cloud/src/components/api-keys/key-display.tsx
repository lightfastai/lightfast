"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Separator } from "@repo/ui/components/ui/separator";
import { Badge } from "@repo/ui/components/ui/badge";
import { AlertTriangle, Eye, EyeOff, Shield, Clock } from "lucide-react";
import { CopyKeyButton } from "./copy-key-button";
import { formatExpirationDate } from "./validation-schema";
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
  const [hasBeenCopied, setHasBeenCopied] = useState(false);

  // Format the API key for display (add spaces for readability)
  const formatApiKey = (key: string) => {
    return key.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const handleKeyCopied = () => {
    setHasBeenCopied(true);
    onKeyCopied?.();
  };

  // Security warning messages
  const getSecurityLevel = () => {
    if (hasBeenCopied) {
      return {
        icon: <Shield className="h-4 w-4" />,
        message: "Key has been copied to clipboard",
        variant: "default" as const,
      };
    }
    
    if (isVisible) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        message: "Key is currently visible on screen",
        variant: "destructive" as const,
      };
    }

    return {
      icon: <Shield className="h-4 w-4" />,
      message: "Key is hidden for security",
      variant: "default" as const,
    };
  };

  const securityLevel = getSecurityLevel();

  return (
    <div className="space-y-6">
      {/* Critical Security Warning */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Important:</strong> This is the only time you'll see this API key. 
          Copy it now and store it securely. We cannot recover it later.
        </AlertDescription>
      </Alert>

      {/* Key Information Card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Header with key info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg">{keyName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">ID: {keyId}</span>
                <Badge variant="secondary" className="text-xs">
                  New
                </Badge>
              </div>
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                Created {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(createdAt)}
              </div>
              {expiresAt && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Expires: </span>
                  <span className="font-medium">{formatExpirationDate(expiresAt)}</span>
                </div>
              )}
              {!expiresAt && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Expires: </span>
                  <span className="font-medium">Never</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* API Key Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">API Key</label>
              <Alert className={`p-2 w-fit ${
                securityLevel.variant === "destructive" 
                  ? "border-destructive/50 bg-destructive/10" 
                  : "border-muted bg-muted/50"
              }`}>
                <AlertDescription className="flex items-center gap-2 text-xs">
                  {securityLevel.icon}
                  {securityLevel.message}
                </AlertDescription>
              </Alert>
            </div>

            {/* Key display area */}
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
                variant={hasBeenCopied ? "secondary" : "default"}
                className="min-w-[150px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Best Practices
          </h4>
          
          <div className="grid gap-2 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
              <span>Store your API key in environment variables, never in your code</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
              <span>Never share your API key publicly or commit it to version control</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
              <span>Regenerate your key immediately if you suspect it's been compromised</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
              <span>Use different keys for different environments (dev, staging, prod)</span>
            </div>
            {expiresAt && (
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>Set up a reminder to rotate this key before it expires</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}