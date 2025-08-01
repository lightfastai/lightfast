"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export function AnalyticsInterface() {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    // Generate a unique session ID when component mounts
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    setSessionId(`session-${timestamp}-${random}`);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-muted/30 px-4 py-1.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{sessionId}</p>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {/* Empty analytics area */}
      </div>
    </div>
  );
}