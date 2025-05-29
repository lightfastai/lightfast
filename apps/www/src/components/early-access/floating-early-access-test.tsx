"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";

export function FloatingEarlyAccessTest() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="grid grid-cols-[400px_200px] items-end gap-8">
      {/* Chat Component - fixed width column */}
      <div className="flex flex-col items-start">
        <div className="relative">
          {/* Expanding Card */}
          <div
            className={`expanding-card ${isExpanded ? "expanded" : "collapsed"} `}
          >
            <Card className="w-96 shadow-xl backdrop-blur-sm">
              <CardContent className="space-y-4">
                {/* Header area with close button */}
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => setIsExpanded(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Messages - 3 lines of text */}
                <div className="space-y-4">
                  <div className="text-sm">
                    Simplifying the way you interact with applications like
                    Blender, Unity, Fusion360 and more.
                  </div>

                  <div className="text-sm">
                    Ready to get started? Join our waitlist for early access!
                  </div>

                  <div className="text-sm">
                    Experience the future of creative workflow automation.
                  </div>
                </div>

                {/* Bottom row - Input area with space for logo */}
                <div className="relative flex items-center gap-3">
                  {/* Space for logo - positioned to align with the clickable logo */}
                  <div className="h-12 w-8 flex-shrink-0" />

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
              </CardContent>
            </Card>
          </div>

          {/* Logo - Always visible and acts as anchor point in bottom row */}
          <Button
            className={`absolute bottom-8 left-4 z-20 cursor-pointer transition-all duration-500 ease-out ${isExpanded ? "opacity-80" : "opacity-100 hover:scale-110"} `}
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
          >
            <Icons.logoShort className="h-6 w-6 text-white" />
          </Button>
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
              onClick={() => setIsExpanded(true)}
              variant={isExpanded ? "default" : "ghost"}
              size="sm"
              className={`h-8 flex-1 rounded-md transition-all ${
                isExpanded ? "shadow-sm" : "hover:bg-background/60"
              }`}
            >
              Expand
            </Button>
            <Button
              onClick={() => setIsExpanded(false)}
              variant={!isExpanded ? "default" : "ghost"}
              size="sm"
              className={`h-8 flex-1 rounded-md transition-all ${
                !isExpanded ? "shadow-sm" : "hover:bg-background/60"
              }`}
            >
              Collapse
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
