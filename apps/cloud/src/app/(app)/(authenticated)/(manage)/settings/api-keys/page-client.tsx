"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Plus } from "lucide-react";
import { useState, useCallback } from "react";

import { ApiKeyCreation, ApiKeys } from "./_components";

export function ApiKeysPageClient() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [_keyListRefreshTrigger, setKeyListRefreshTrigger] = useState(0);

  const handleCreateKey = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setShowCreateDialog(open);
  }, []);

  const handleKeyCreated = useCallback(() => {
    // Trigger refresh of the API key list
    setKeyListRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">API Keys</h2>
          <p className="text-muted-foreground text-sm">
            Create and manage API keys to access the Lightfast Cloud API.
          </p>
        </div>
        <Button className="gap-2" onClick={handleCreateKey}>
          <Plus className="size-4" />
          Create API Key
        </Button>
      </div>

      {/* API Keys Component */}
      <ApiKeys onCreateKey={handleCreateKey} key={_keyListRefreshTrigger} />

      {/* API Key Creation Dialog */}
      <ApiKeyCreation
        open={showCreateDialog}
        onOpenChange={handleDialogClose}
        onKeyCreated={handleKeyCreated}
      />
    </div>
  );
}