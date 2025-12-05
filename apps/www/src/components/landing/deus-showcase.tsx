"use client";

import { WorkflowShowcase } from "./workflow-showcase";
import { LightfastImageViewer } from "~/components/image-viewer";
import { Plus } from "lucide-react";

export function DeusShowcase() {
  return (
    <LightfastImageViewer
      src="/images/playground-placeholder-1.webp"
      alt="Background"
    >
      {/* Window Frame Container */}
      <div className="relative flex items-center justify-center w-full h-full p-8">
        <div className="w-[90%] h-[85%] min-w-[800px]">
          {/* Window Chrome */}
          <div className="w-full bg-background/80 backdrop-blur-xl h-full rounded-lg shadow-2xl overflow-hidden border border-border flex flex-col">
            {/* Title Bar */}
            <div className="h-8 flex items-center px-2 flex-shrink-0 relative">
              {/* macOS-style dots */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-border/80" />
                <div className="w-3 h-3 rounded-full bg-border/80" />
                <div className="w-3 h-3 rounded-full bg-border/80" />
              </div>

              {/* File path with plus icon */}
              <div className="flex items-center gap-2 ml-4">
                <div className="relative">
                  <span className="text-xs text-muted-foreground font-mono">
                    ~/work-env/lightfast-internal
                  </span>
                  {/* Green highlight under path */}
                  <div className="absolute bottom-[-5px] left-0 right-0 h-0.5 bg-green-500/60" />
                </div>
                <Plus className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              <WorkflowShowcase />
            </div>
          </div>
        </div>
      </div>
    </LightfastImageViewer>
  );
}
