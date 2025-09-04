"use client";

import { useState } from "react";
import { 
  MoreHorizontal,
  Copy,
  Eye,
  Ban,
  Trash2,
  KeyRound
} from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";

import { useApiKeyActions, type ApiKeyAction } from "~/hooks/use-api-key-actions";
import { RevokeKeyDialog } from "./revoke-key-dialog";
import { DeleteKeyDialog } from "./delete-key-dialog";
import { KeyDetailsModal } from "./key-details-modal";

interface KeyActionsMenuProps {
  apiKey: ApiKeyAction;
}

/**
 * Dropdown menu with context-aware actions for API keys
 */
export function KeyActionsMenu({ apiKey }: KeyActionsMenuProps) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const { 
    copyPreview, 
    copyKeyId, 
    canRevoke, 
    canDelete, 
    getKeyStatus,
    isLoading 
  } = useApiKeyActions();

  const status = getKeyStatus(apiKey);
  const isKeyLoading = isLoading === apiKey.id;

  const handleCopyPreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    await copyPreview(apiKey.keyPreview);
  };

  const handleCopyId = async (e: React.MouseEvent) => {
    e.preventDefault();
    await copyKeyId(apiKey.id);
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowDetailsModal(true);
  };

  const handleRevoke = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowRevokeDialog(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowDeleteDialog(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 data-[state=open]:bg-muted"
            disabled={isKeyLoading}
          >
            <span className="sr-only">Open actions menu for {apiKey.name}</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{apiKey.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {apiKey.keyPreview}
              </p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Copy Actions */}
          <DropdownMenuItem onClick={handleCopyPreview} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Copy Preview
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleCopyId} className="cursor-pointer">
            <KeyRound className="mr-2 h-4 w-4" />
            Copy Key ID
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* View Details */}
          <DropdownMenuItem onClick={handleViewDetails} className="cursor-pointer">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Status-dependent Actions */}
          {canRevoke(apiKey) && (
            <DropdownMenuItem 
              onClick={handleRevoke} 
              className="cursor-pointer text-orange-600 focus:text-orange-600 dark:text-orange-400 dark:focus:text-orange-400"
            >
              <Ban className="mr-2 h-4 w-4" />
              Revoke Key
            </DropdownMenuItem>
          )}
          
          {canDelete(apiKey) && (
            <DropdownMenuItem 
              onClick={handleDelete}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Key
            </DropdownMenuItem>
          )}
          
          {/* Status indicator when no actions available */}
          {!canRevoke(apiKey) && !canDelete(apiKey) && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <div className="flex items-center">
                <div className={`mr-2 h-2 w-2 rounded-full ${
                  status === 'expired' ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                {status === 'expired' ? 'Key Expired' : 'Key Revoked'}
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialogs */}
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
      
      <KeyDetailsModal
        apiKey={apiKey}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />
    </>
  );
}