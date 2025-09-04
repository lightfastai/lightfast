"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Calendar, Clock, Key } from "lucide-react";

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
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

import { useApiKeyActions, type ApiKeyAction } from "~/hooks/use-api-key-actions";

interface DeleteKeyDialogProps {
  apiKey: ApiKeyAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation dialog for permanently deleting API keys with type-to-confirm safety
 */
export function DeleteKeyDialog({ 
  apiKey, 
  open, 
  onOpenChange 
}: DeleteKeyDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const { deleteKey, isDeleting, canDelete } = useApiKeyActions();

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
    if (confirmationText !== apiKey.name) {
      return;
    }

    setIsConfirming(true);
    
    try {
      const result = await deleteKey(apiKey.id, apiKey.name);
      
      if (result.success) {
        onOpenChange(false);
        setConfirmationText("");
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmationText("");
    }
    onOpenChange(open);
  };

  const isLoading = isConfirming || isDeleting;
  const isConfirmationValid = confirmationText === apiKey.name;

  // Only allow deletion of revoked keys
  if (!canDelete(apiKey)) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-red-900 dark:text-red-100">
                Delete API Key Permanently
              </AlertDialogTitle>
            </div>
          </div>
          
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                This will permanently delete the API key and all its associated data. 
                This action cannot be undone.
              </p>
              
              {/* Key Information */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{apiKey.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {apiKey.keyPreview}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Revoked
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
              </div>
              
              {/* Danger Warning */}
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 dark:bg-red-950/20 dark:border-red-900/50">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-800 dark:text-red-200">
                    <p className="font-medium mb-1">Danger Zone:</p>
                    <ul className="space-y-1">
                      <li>• This action is irreversible and permanent</li>
                      <li>• All key usage history will be lost</li>
                      <li>• You cannot restore the deleted key</li>
                      <li>• Create a new key if you need API access again</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Confirmation Input */}
              <div className="space-y-2">
                <Label htmlFor="confirmation" className="text-sm font-medium">
                  Type the key name <span className="font-mono bg-muted px-1 rounded text-xs">{apiKey.name}</span> to confirm:
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={apiKey.name}
                  className="font-mono"
                  disabled={isLoading}
                />
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
            disabled={isLoading || !isConfirmationValid}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting...
              </>
            ) : (
              'Delete Permanently'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}