"use client";

import { useState } from "react";
import { AlertTriangle, Calendar, Clock, Key } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";

import { useApiKeyActions, type ApiKeyAction } from "~/hooks/use-api-key-actions";

interface RevokeKeyDialogProps {
  apiKey: ApiKeyAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation dialog for revoking API keys with detailed information and warnings
 */
export function RevokeKeyDialog({ 
  apiKey, 
  open, 
  onOpenChange 
}: RevokeKeyDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const { revokeKey, isRevoking } = useApiKeyActions();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    
    try {
      const result = await revokeKey(apiKey.id, apiKey.name);
      
      if (result.success) {
        onOpenChange(false);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const isLoading = isConfirming || isRevoking;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            </div>
          </div>
          
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                Are you sure you want to revoke this API key? This action will immediately 
                disable the key and prevent any applications using it from accessing the API.
              </p>
              
              {/* Key Information */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{apiKey.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {apiKey.keyPreview}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {formatDate(apiKey.createdAt)}
                  </div>
                  
                  {apiKey.lastUsedAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last used {formatDate(apiKey.lastUsedAt)}
                    </div>
                  )}
                </div>
                
                {apiKey.expiresAt && (
                  <div className="text-xs text-muted-foreground">
                    Expires {formatDate(apiKey.expiresAt)}
                  </div>
                )}
              </div>
              
              {/* Warning */}
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 dark:bg-orange-950/20 dark:border-orange-900/50">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-orange-800 dark:text-orange-200">
                    <p className="font-medium mb-1">Important:</p>
                    <ul className="space-y-1">
                      <li>• Applications using this key will lose access immediately</li>
                      <li>• API requests with this key will be rejected</li>
                      <li>• You can delete revoked keys permanently later</li>
                      <li>• This action cannot be undone - create a new key if needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Revoking...
              </>
            ) : (
              'Revoke Key'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}