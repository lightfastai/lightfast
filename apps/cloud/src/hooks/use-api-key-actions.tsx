"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "~/trpc/react";

export interface ApiKeyAction {
  id: string;
  name: string;
  keyPreview: string;
  active: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isExpired?: boolean;
}

/**
 * Custom hook to manage API key actions with optimistic updates and error handling
 */
export function useApiKeyActions() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  const api = useTRPC();
  const revokeMutation = (api as any).apiKey.revoke.useMutation({});
  const deleteMutation = (api as any).apiKey.delete.useMutation({});

  /**
   * Revoke an API key with optimistic update
   */
  const revokeKey = async (keyId: string, keyName: string) => {
    if (isLoading) return { success: false, error: "Operation in progress" };

    setIsLoading(keyId);

    try {
      // Optimistic update - immediately mark as revoked
      (api as any).apiKey.list.setData?.(
        { includeInactive: false },
        (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((key: any) =>
            key.id === keyId ? { ...key, active: false } : key
          );
        }
      );

      // Also update the inclusive list if it exists
      (api as any).apiKey.list.setData?.(
        { includeInactive: true },
        (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((key: any) =>
            key.id === keyId ? { ...key, active: false } : key
          );
        }
      );

      const result = await revokeMutation.mutateAsync({ keyId });

      toast.success(result.message || `API key "${keyName}" has been revoked`);

      // Invalidate queries to ensure fresh data
      await (api as any).apiKey.list.invalidate?.();

      return { success: true };
    } catch (error: any) {
      // Rollback optimistic update
      await (api as any).apiKey.list.invalidate?.();

      const errorMessage = error?.message || "Failed to revoke API key";
      toast.error(errorMessage);

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(null);
    }
  };

  /**
   * Delete an API key permanently with optimistic update
   */
  const deleteKey = async (keyId: string, keyName: string) => {
    if (isLoading) return { success: false, error: "Operation in progress" };

    setIsLoading(keyId);

    try {
      // Optimistic update - immediately remove from list
      (api as any).apiKey.list.setData?.(
        { includeInactive: false },
        (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.filter((key: any) => key.id !== keyId);
        }
      );

      (api as any).apiKey.list.setData?.(
        { includeInactive: true },
        (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.filter((key: any) => key.id !== keyId);
        }
      );

      const result = await deleteMutation.mutateAsync({ keyId });

      toast.success(result.message || `API key "${keyName}" has been permanently deleted`);

      // Invalidate queries to ensure fresh data
      await (api as any).apiKey.list.invalidate?.();

      return { success: true };
    } catch (error: any) {
      // Rollback optimistic update
      await (api as any).apiKey.list.invalidate?.();

      const errorMessage = error?.message || "Failed to delete API key";
      toast.error(errorMessage);

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(null);
    }
  };

  /**
   * Copy text to clipboard with fallback methods
   */
  const copyToClipboard = async (text: string, description: string) => {
    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success(`${description} copied to clipboard`);
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
        toast.success(`${description} copied to clipboard`);
        return { success: true };
      } catch (fallbackError) {
        throw new Error("Copy command failed");
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (error) {
      toast.error(`Failed to copy ${description.toLowerCase()}`);
      return { success: false, error: "Copy failed" };
    }
  };

  /**
   * Copy API key preview
   */
  const copyPreview = async (keyPreview: string) => {
    return copyToClipboard(keyPreview, "API key preview");
  };

  /**
   * Copy API key ID
   */
  const copyKeyId = async (keyId: string) => {
    return copyToClipboard(keyId, "API key ID");
  };

  /**
   * Copy creation date
   */
  const copyCreationDate = async (createdAt: string) => {
    const date = new Date(createdAt).toLocaleString();
    return copyToClipboard(date, "Creation date");
  };

  /**
   * Refresh the API key list
   */
  const refreshList = async () => {
    await (api as any).apiKey.list.invalidate?.();
  };

  /**
   * Check if a key can be deleted (only revoked keys can be deleted)
   */
  const canDelete = (key: ApiKeyAction) => {
    return !key.active;
  };

  /**
   * Check if a key can be revoked (only active keys can be revoked)
   */
  const canRevoke = (key: ApiKeyAction) => {
    return key.active;
  };

  /**
   * Get key status with expiration check
   */
  const getKeyStatus = (key: ApiKeyAction) => {
    if (!key.active) return "revoked";
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return "expired";
    return "active";
  };

  return {
    // State
    isLoading,

    // Actions
    revokeKey,
    deleteKey,
    copyPreview,
    copyKeyId,
    copyCreationDate,
    refreshList,

    // Utilities
    canDelete,
    canRevoke,
    getKeyStatus,

    // Mutation states
    isRevoking: revokeMutation.isPending || false,
    isDeleting: deleteMutation.isPending || false,
  };
}