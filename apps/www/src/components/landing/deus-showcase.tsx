"use client";

import { WorkflowShowcase } from "./workflow-showcase";
import Image from "next/image";

export function DeusShowcase() {
  return (
    <div className="relative w-full h-full min-h-[700px]">
      {/* Background Image */}
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <Image
          src="/images/playground-placeholder-1.webp"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Window Frame Container */}
      <div className="relative flex items-center justify-center w-full h-full p-8">
        <div className="w-[90%] h-[85%] min-w-[800px]">
          {/* Window Chrome */}
          <div className="w-full h-full rounded-lg shadow-2xl overflow-hidden bg-background border border-border flex flex-col">
            {/* Title Bar */}
            <div className="h-12 bg-muted/50 border-b border-border flex items-center px-4 flex-shrink-0">
              {/* macOS-style dots */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>

              {/* Window Title */}
              <div className="flex-1 flex justify-center">
                <span className="text-sm text-foreground/60">Deus</span>
              </div>

              {/* Spacer to balance the dots */}
              <div className="w-[52px]" />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              <WorkflowShowcase />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
