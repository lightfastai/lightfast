import dynamic from "next/dynamic";

import { Icons } from "@repo/ui/components/icons";
import { cn } from "@repo/ui/lib/utils";

import { CenterCardEarlyAccessForm } from "../early-access/early-access-form";

// Dynamically import the client component
const NextPhaseButton = dynamic(
  () =>
    import("./next-phase-button").then((mod) => ({
      default: mod.NextPhaseButton,
    })),
  { ssr: true },
);

// Removed streaming text functionality

export const LeaderCard = () => {
  return (
    <div className={cn("optimized-center-card")}>
      {/* Text content (top-left, fades out during text phase) */}
      <div className="center-card-text absolute top-8 right-8 left-8">
        <p className="max-w-sm text-4xl font-bold">
          Automate your workflow with an intelligent creative copilot.
        </p>
      </div>

      {/* Logo (transforms from bottom-left to center during logo phase) */}
      <div className="center-card-logo absolute flex items-center justify-center">
        <Icons.logoShort className="text-primary" />
      </div>

      {/* Bottom Content Area - contains both button and form */}
      <div className="absolute right-8 bottom-8 left-8">
        {/* Next Phase Button - only visible in initial state */}
        <div className="flex justify-end">
          <NextPhaseButton />
        </div>
      </div>

      {/* Early Access Content (appears during early access phase) */}
      <div className="center-card-early-access-container absolute inset-0">
        {/* Early Access Text (top-left position) */}
        <div className="absolute top-8 right-8 left-8 max-w-sm">
          <div className="text-white">
            <p className="mb-2 text-2xl font-bold">
              Simplifying the way you interact with applications like Blender,
              Unity, Fusion360 and more.
            </p>
            <p className="text-sm text-white/80">
              Join the waitlist to get early access.
            </p>
          </div>
        </div>

        {/* Early Access Form (spans whole card width) */}
        <div className="absolute right-8 bottom-8 left-8">
          <CenterCardEarlyAccessForm />
        </div>
      </div>
    </div>
  );
};
