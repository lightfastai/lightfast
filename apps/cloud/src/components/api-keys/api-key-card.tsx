"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@repo/ui/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Ban, Trash2, Calendar, Clock, Key } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@repo/ui/hooks/use-toast";

import { KeyStatusBadge } from "./key-status-badge";


interface ApiKeyCardProps {
  apiKey: {
    id: string;
    name: string;
    keyPreview: string;
    active: boolean;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    isExpired?: boolean;
  };
  onRevoke: (keyId: string, keyName: string) => void;
  onDelete: (keyId: string, keyName: string) => void;
  isRevoking?: boolean;
  isDeleting?: boolean;
}

export function ApiKeyCard({ 
  apiKey, 
  onRevoke, 
  onDelete, 
  isRevoking = false, 
  isDeleting = false 
}: ApiKeyCardProps) {
  const isActionDisabled = isRevoking || isDeleting;
  const { toast } = useToast();

  const copyKeyPreview = async () => {
    try {
      await navigator.clipboard.writeText(apiKey.keyPreview);
      toast({
        title: "Copied to clipboard",
        description: "Key preview copied to clipboard",
      });
    } catch (_error) {
      toast({
        title: "Failed to copy",
        description: "Failed to copy key preview",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (_error) {
      return "Unknown";
    }
  };

  const getExpiryInfo = () => {
    if (!apiKey.expiresAt) return null;
    
    const expiryDate = new Date(apiKey.expiresAt);
    const now = new Date();
    const isExpired = expiryDate < now;
    
    if (isExpired) {
      return {
        text: `Expired ${formatDistanceToNow(expiryDate, { addSuffix: true })}`,
        className: "text-red-600 dark:text-red-400"
      };
    }
    
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 7) {
      return {
        text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
        className: "text-orange-600 dark:text-orange-400"
      };
    }
    
    return {
      text: `Expires ${formatDistanceToNow(expiryDate, { addSuffix: true })}`,
      className: "text-muted-foreground"
    };
  };

  const expiryInfo = getExpiryInfo();

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate">{apiKey.name}</h3>
            <div className="flex items-center gap-2">
              <KeyStatusBadge
                isActive={apiKey.active}
                isExpired={apiKey.isExpired ?? false}
                expiresAt={apiKey.expiresAt}
              />
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                disabled={isActionDisabled}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={copyKeyPreview}>
                <Copy className="size-4" />
                Copy Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {apiKey.active && (
                <DropdownMenuItem
                  onClick={() => onRevoke(apiKey.id, apiKey.name)}
                  className="text-orange-600 focus:text-orange-600 dark:text-orange-400"
                  disabled={isRevoking}
                >
                  <Ban className="size-4" />
                  {isRevoking ? "Revoking..." : "Revoke Key"}
                </DropdownMenuItem>
              )}
              {!apiKey.active && (
                <DropdownMenuItem
                  onClick={() => onDelete(apiKey.id, apiKey.name)}
                  className="text-red-600 focus:text-red-600 dark:text-red-400"
                  disabled={isDeleting}
                >
                  <Trash2 className="size-4" />
                  {isDeleting ? "Deleting..." : "Delete Key"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Preview */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Key Preview
          </label>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Key className="size-4 text-muted-foreground shrink-0" />
            <code className="text-sm font-mono flex-1 truncate">
              {apiKey.keyPreview}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyKeyPreview}
              className="h-6 w-6 p-0 shrink-0"
            >
              <Copy className="size-3" />
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created</span>
            <div className="flex items-center gap-1 text-foreground">
              <Calendar className="size-3" />
              {formatDate(apiKey.createdAt)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last used</span>
            <div className="flex items-center gap-1 text-foreground">
              <Clock className="size-3" />
              {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "Never"}
            </div>
          </div>

          {expiryInfo && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expiry</span>
              <div className={`flex items-center gap-1 text-sm ${expiryInfo.className}`}>
                <Calendar className="size-3" />
                {expiryInfo.text}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}