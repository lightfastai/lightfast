import type { Metadata } from "next";

import { Icons } from "@repo/ui/components/icons";

export const metadata: Metadata = {
  title: "Home",
  description: "Join the waitlist to get early access to Lightfast",
};

export default function Home() {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center">
      {/* Lines extending from square corners */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top horizontal lines */}
        <div
          className="bg-border absolute h-[1px]"
          style={{
            top: "calc(50vh - 300px)",
            left: 0,
            width: "calc(50vw - 300px)",
          }}
        />
        <div
          className="bg-border absolute h-[1px]"
          style={{
            top: "calc(50vh - 300px)",
            left: "calc(50vw + 300px)",
            width: "calc(50vw - 300px)",
          }}
        />

        {/* Bottom horizontal lines */}
        <div
          className="bg-border absolute h-[1px]"
          style={{
            top: "calc(50vh + 300px - 1px)",
            left: 0,
            width: "calc(50vw - 300px)",
          }}
        />
        <div
          className="bg-border absolute h-[1px]"
          style={{
            top: "calc(50vh + 300px - 1px)",
            left: "calc(50vw + 300px)",
            width: "calc(50vw - 300px)",
          }}
        />

        {/* Left vertical lines */}
        <div
          className="bg-border absolute w-[1px]"
          style={{
            left: "calc(50vw - 300px)",
            top: 0,
            height: "calc(50vh - 300px)",
          }}
        />
        <div
          className="bg-border absolute w-[1px]"
          style={{
            left: "calc(50vw - 300px )",
            top: "calc(50vh + 300px)",
            height: "calc(50vh - 300px)",
          }}
        />

        {/* Right vertical lines */}
        <div
          className="bg-border absolute w-[1px]"
          style={{
            left: "calc(50vw + 300px - 1px)",
            top: 0,
            height: "calc(50vh - 300px)",
          }}
        />
        <div
          className="bg-border absolute w-[1px]"
          style={{
            left: "calc(50vw + 300px - 1px)",
            top: "calc(50vh + 300px)",
            height: "calc(50vh - 300px - 1px)",
          }}
        />
      </div>

      <div className="bg-card border-border relative aspect-square w-[600px] border shadow-2xl">
        {/* Text in top left */}
        <div className="absolute top-8 left-8 max-w-[400px]">
          <p className="text-foreground text-2xl font-medium">
            The intelligent creative copilot that simplifies the way you
            interact with applications like Blender, Unity, Fusion360 and more.
          </p>
        </div>

        {/* Logo in bottom left */}
        <div className="absolute bottom-8 left-8">
          <Icons.logoShort className="text-primary h-12 w-12" />
        </div>
      </div>
    </div>
  );
}
