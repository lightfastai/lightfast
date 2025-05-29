"use client";

import { useState } from "react";
import { Maximize2, MessageCircle, Minimize2, Send } from "lucide-react";

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
        {/* Morphing container - transitions between chat and button */}
        <div
          onClick={isMinimized ? () => setIsMinimized(false) : undefined}
          className={`bg-background relative overflow-hidden border shadow-lg transition-all duration-800 ease-out ${
            isMinimized
              ? "w-auto cursor-pointer rounded-lg px-4 py-3 hover:shadow-xl starting:w-96 starting:rounded-2xl starting:px-0 starting:py-0"
              : "w-96 rounded-2xl starting:w-auto starting:rounded-lg starting:px-4 starting:py-3"
          }`}
        >
          {/* Button content - shows when minimized */}
          <div
            className={`transition-all delay-300 duration-500 ease-out ${
              isMinimized
                ? "opacity-100 starting:translate-y-1 starting:scale-95 starting:opacity-0"
                : "pointer-events-none translate-y-1 scale-95 opacity-0"
            }`}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--gradient-sky)" }}
              ></div>
              <span className="text-sm font-medium">
                Click here to join our early access
              </span>
            </div>
          </div>

          {/* Chat content - shows when expanded */}
          <div
            className={`transition-all delay-300 duration-500 ease-out ${
              isMinimized
                ? "pointer-events-none absolute inset-0 -translate-y-2 scale-105 opacity-0"
                : "opacity-100 starting:-translate-y-2 starting:scale-105 starting:opacity-0"
            }`}
          >
            {/* Chat header */}
            <div className="grid h-10 grid-cols-[1fr_auto] items-center border-b px-4">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--gradient-sky)" }}
                ></div>
                <Icons.logoShort className="h-3 w-auto" />
              </div>
              <MessageCircle className="text-muted-foreground h-4 w-4" />
            </div>

            {/* Chat content */}
            <div className="max-h-96 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* Sample messages for testing */}
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

                {/* Simple form for testing */}
                <div className="relative">
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
          </div>
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
