"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Plus, ExternalLink } from "lucide-react";
import { useState, useCallback } from "react";

import { CreateKeyDialog, ApiKeyList } from "~/components/api-keys";

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

      {/* API Key List Component */}
      <ApiKeyList onCreateKey={handleCreateKey} key={_keyListRefreshTrigger} />

      {/* Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documentation & Best Practices</CardTitle>
          <CardDescription>
            Learn how to use API keys securely with Lightfast Cloud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Getting Started</h4>
                <p className="text-xs text-muted-foreground">
                  API keys authenticate your requests to the Lightfast Cloud API. 
                  Create a key, copy it securely, and use it in your CLI or applications.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Usage</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Set your API key as an environment variable:</p>
                  <code className="block bg-muted p-2 rounded text-xs mt-1">
                    export LIGHTFAST_API_KEY=lf_your_key_here
                  </code>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Security Best Practices</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Never share your API keys publicly or commit them to version control</li>
                  <li>• Use environment variables to store keys securely</li>
                  <li>• Set expiration dates to rotate keys regularly</li>
                  <li>• Revoke unused or compromised keys immediately</li>
                  <li>• Monitor key usage and last used timestamps</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="size-4" />
              View Full Documentation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Key Creation Dialog */}
      <CreateKeyDialog
        open={showCreateDialog}
        onOpenChange={handleDialogClose}
        onKeyCreated={handleKeyCreated}
      />
    </div>
  );
}