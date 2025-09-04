"use client";

import { useState } from "react";
import { 
  Key, 
  Calendar, 
  Clock, 
  Activity, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  Ban,
  Trash2,
  Copy,
  X
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";

import { useApiKeyActions, type ApiKeyAction } from "~/hooks/use-api-key-actions";
import { CopyOperations } from "./copy-operations";
import { RevokeKeyDialog } from "./revoke-key-dialog";
import { DeleteKeyDialog } from "./delete-key-dialog";

interface KeyDetailsModalProps {
  apiKey: ApiKeyAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Detailed modal view of API key information with action buttons
 */
export function KeyDetailsModal({ 
  apiKey, 
  open, 
  onOpenChange 
}: KeyDetailsModalProps) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const { canRevoke, canDelete, getKeyStatus } = useApiKeyActions();

  const status = getKeyStatus(apiKey);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 30) return `${diffInDays} days ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'revoked':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Active</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{apiKey.name}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2 mt-1">
                    {getStatusIcon()}
                    {getStatusBadge()}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Key Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Key Preview</h4>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      {apiKey.keyPreview}
                    </code>
                    <CopyOperations apiKey={apiKey} variant="ghost" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Key ID</h4>
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono block truncate">
                    {apiKey.id}
                  </code>
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    <div className="text-sm font-medium">
                      {formatDate(apiKey.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(apiKey.createdAt)}
                    </div>
                  </div>
                </div>

                {apiKey.lastUsedAt && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Last Used</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      <div className="text-sm font-medium">
                        {formatDate(apiKey.lastUsedAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(apiKey.lastUsedAt)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {apiKey.expiresAt && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Expires</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      <div className="text-sm font-medium">
                        {formatDate(apiKey.expiresAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(apiKey.expiresAt) > new Date() 
                          ? `In ${Math.ceil((new Date(apiKey.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`
                          : "Expired"
                        }
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Usage Statistics Placeholder */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Usage Statistics</h4>
              </div>
              <div className="text-sm text-muted-foreground text-center py-4">
                Usage statistics will be available in a future update
              </div>
            </div>

            {/* Security Information */}
            {status !== 'active' && (
              <div className="rounded-lg bg-muted/50 border p-4">
                <div className="flex items-center gap-2 mb-2">
                  {status === 'revoked' ? (
                    <Ban className="h-4 w-4 text-red-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <h4 className="font-medium text-sm">
                    {status === 'revoked' ? 'Key Revoked' : 'Key Expired'}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {status === 'revoked' 
                    ? 'This API key has been revoked and can no longer be used for authentication. You can permanently delete it if no longer needed.'
                    : 'This API key has expired and can no longer be used for authentication. Create a new key or extend the expiration date.'
                  }
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t">
              <div className="flex gap-2">
                {canRevoke(apiKey) && (
                  <Button
                    variant="outline"
                    onClick={() => setShowRevokeDialog(true)}
                    className="text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Revoke Key
                  </Button>
                )}

                {canDelete(apiKey) && (
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Key
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nested Dialogs */}
      <RevokeKeyDialog
        apiKey={apiKey}
        open={showRevokeDialog}
        onOpenChange={setShowRevokeDialog}
      />
      
      <DeleteKeyDialog
        apiKey={apiKey}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}