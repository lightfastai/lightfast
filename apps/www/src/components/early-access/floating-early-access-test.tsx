"use client";

import { useState } from "react";
import { Maximize2, Minimize2, Send } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export function FloatingEarlyAccessTest() {
  // Manual control for testing - not scroll-triggered
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="grid grid-cols-[400px_200px] items-center gap-8">
      {/* Chat Component - fixed width column */}
      <div className="flex flex-col items-start">
        {/* Morphing container - expands around the logo */}
        <div
          onClick={isMinimized ? () => setIsMinimized(false) : undefined}
          className={`bg-background relative overflow-hidden border shadow-lg transition-all duration-600 ease-out ${
            isMinimized
              ? "h-12 w-16 cursor-pointer rounded-xl hover:shadow-xl"
              : "h-auto w-96 rounded-2xl"
          }`}
        >
          {/* Messages content */}
          <div
            className={`transition-all duration-400 ${
              isMinimized
                ? "scale-95 opacity-0"
                : "scale-100 opacity-100 delay-400"
            }`}
          >
            <div className="space-y-4 p-4">
              <div className="flex items-start">
                <div className="text-sm">
                  Simplifying the way you interact with applications like
                  Blender, Unity, Fusion360 and more.
                </div>
              </div>

              <div className="flex items-start">
                <div className="text-sm">
                  Ready to get started? Join our waitlist for early access!
                </div>
              </div>
            </div>
          </div>

          {/* Input area with fixed logo position */}
          <div className="p-4">
            <div
              className={`relative flex items-center gap-3 transition-all duration-400 ${
                isMinimized ? "opacity-0" : "opacity-100 delay-400"
              }`}
            >
              {/* Logo - stays in fixed position */}
              <Icons.logoShort className="h-6 w-auto flex-shrink-0" />

              {/* Input field */}
              <div className="relative flex-1">
                <Input
                  className="pr-12 text-sm"
                  placeholder="Curious? Enter your email for early access"
                  disabled
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  className="hover:bg-muted absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 p-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Minimized state logo - positioned to align with the input logo */}
          <Icons.logoShort
            className={`absolute top-1/2 left-4 h-6 w-auto -translate-y-1/2 transition-all duration-600 ease-out ${
              isMinimized ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      </div>

      {/* Controls Panel */}
      <div className="bg-card rounded-xl border p-4 shadow-sm">
        <div className="mb-4 text-sm font-semibold">Controls</div>

        {/* State Section */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            State
          </div>
          <div className="bg-muted flex gap-0 rounded-lg p-1">
            <Button
              onClick={() => setIsMinimized(false)}
              variant={!isMinimized ? "default" : "ghost"}
              size="sm"
              className={`h-8 flex-1 rounded-md transition-all ${
                !isMinimized ? "shadow-sm" : "hover:bg-background/60"
              }`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={() => setIsMinimized(true)}
              variant={isMinimized ? "default" : "ghost"}
              size="sm"
              className={`h-8 flex-1 rounded-md transition-all ${
                isMinimized ? "shadow-sm" : "hover:bg-background/60"
              }`}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
