import React from "react";
import Link from "next/link";

import { siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

export default function HomePage() {
  const gridLinePositions = {
    // These are the static values from landing.css for desktop
    "--viewport-width": "100vw",
    "--viewport-height": "100vh",
    "--cc-current-width": "min(900px, calc(min(100vw, 100vh) * 0.8))",
    "--cc-current-height": "min(900px, calc(min(100vw, 100vh) * 0.8))",
    "--cc-current-x": "calc(var(--viewport-width) / 2)",
    "--cc-current-y": "calc(var(--viewport-height) / 2)",
    "--card-gap": "12px",
    "--cc-border-width": "1px",
    "--cc-visual-top":
      "calc(var(--cc-current-y) - var(--cc-current-height) / 2 + var(--card-gap) / 2)",
    "--cc-visual-bottom":
      "calc(var(--cc-current-y) + var(--cc-current-height) / 2 - var(--card-gap) / 2 - var(--cc-border-width) / 2)",
    "--cc-visual-left":
      "calc(var(--cc-current-x) - var(--cc-current-width) / 2 + var(--card-gap) / 2)",
    "--cc-visual-right":
      "calc(var(--cc-current-x) + var(--cc-current-width) / 2 - var(--card-gap) / 2 - var(--cc-border-width) / 2)",
  } as React.CSSProperties;

  return (
    <div
      className="bg-background relative h-screen overflow-hidden"
      style={gridLinePositions}
    >
      {/* Static Background Lines */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div
          className="bg-border absolute h-px w-full"
          style={{ top: "calc(var(--cc-visual-top) - 1px)" }}
        />
        <div
          className="bg-border absolute h-px w-full"
          style={{ top: "calc(var(--cc-visual-bottom) + 0.5px)" }}
        />
        <div
          className="bg-border absolute top-0 h-full w-px"
          style={{ left: "calc(var(--cc-visual-left) - 1px)" }}
        />
        <div
          className="bg-border absolute top-0 h-full w-px"
          style={{ left: "calc(var(--cc-visual-right) + 0.5px)" }}
        />
        <div
          className="bg-border absolute h-px w-full"
          style={{
            top: "calc(var(--cc-visual-top) + (var(--cc-visual-bottom) - var(--cc-visual-top)) * 0.33)",
          }}
        />
        <div
          className="bg-border absolute h-px w-full"
          style={{
            top: "calc(var(--cc-visual-top) + (var(--cc-visual-bottom) - var(--cc-visual-top)) * 0.66)",
          }}
        />
        <div
          className="bg-border absolute top-0 h-full w-px"
          style={{
            left: "calc(var(--cc-visual-left) + (var(--cc-visual-right) - var(--cc-visual-left)) * 0.33)",
          }}
        />
        <div
          className="bg-border absolute top-0 h-full w-px"
          style={{
            left: "calc(var(--cc-visual-left) + (var(--cc-visual-right) - var(--cc-visual-left)) * 0.66)",
          }}
        />
      </div>

      <div
        className={cn(
          "bg-white p-4 text-black sm:p-8",
          "border",
          "absolute z-20",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={{
          width: "var(--cc-current-width)",
          height: "var(--cc-current-height)",
        }}
      >
        <div className="relative h-full w-full">
          <div className="absolute top-0 right-0 left-0">
            <p className="max-w-sm text-2xl font-bold sm:text-3xl lg:text-4xl">
              Crafting tomorrow's AI backbone with open-source infrastructure.
            </p>
          </div>

          <div
            className="absolute flex items-end justify-start"
            style={{
              width: "56px",
              height: "32px",
              left: "0",
              top: "calc(100% - 32px)",
            }}
          >
            <Icons.logoShort className="text-primary" />
          </div>

          <div className="absolute right-0 bottom-0 left-0">
            <div className="flex justify-end">
              <Button asChild>
                <Link target="_blank" href={siteConfig.links.chat.href}>
                  Go to Chat App
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
