import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Key, Plus, ExternalLink } from "lucide-react";

interface EmptyStateProps {
  onCreateKey: () => void;
  isCreating?: boolean;
}

export function EmptyState({ onCreateKey, isCreating = false }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-muted/50 rounded-lg flex items-center justify-center mb-6">
          <Key className="size-8 text-muted-foreground" />
        </div>
        
        {/* Heading */}
        <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
        
        {/* Description */}
        <p className="text-muted-foreground text-sm mb-6 max-w-md">
          You haven't created any API keys yet. Create your first API key to start authenticating 
          requests to the Lightfast Cloud API.
        </p>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={onCreateKey} 
            disabled={isCreating}
            className="gap-2"
          >
            <Plus className="size-4" />
            Create Your First API Key
          </Button>
          
          <Button variant="outline" className="gap-2">
            <ExternalLink className="size-4" />
            View Documentation
          </Button>
        </div>
        
        {/* Help Text */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg max-w-md">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Key className="size-4" />
            About API Keys
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1 text-left">
            <li>• Use API keys to authenticate CLI and API requests</li>
            <li>• Keys can be set to expire automatically</li>
            <li>• You can revoke keys at any time</li>
            <li>• Store keys securely - they're only shown once</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}