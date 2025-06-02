import { Icons } from "@repo/ui/components/icons";
import { cn } from "@repo/ui/lib/utils";

import { CenterCardEarlyAccessForm } from "./center-card-early-access-form";

const INTRO_TEXTS = [
  "Simplifying the way you interact with applications like Blender, Unity, Fusion360 and more.",
  // "Lightfast gives your ideas room to grow... to branch, remix and become what they're meant to be.",
  // "We integrate with your tools to make your workflow more efficient.",
  "Join the waitlist to get early access.",
];

export const CenterCard = () => {
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

      {/* Early Access Chat (appears during early access phase) */}
      <div className="center-card-early-access-container absolute inset-0">
        <div className="center-card-early-access absolute top-8 right-8 left-8">
          {/* Animated intro messages - CSS driven */}
          <div
            className="mb-12 max-w-md space-y-4"
            aria-live="polite"
            aria-atomic="false"
          >
            {INTRO_TEXTS.map((text, index) => (
              <div
                key={`intro-${index}`}
                className="early-access-text text-2xl font-bold"
                data-index={index}
                role="status"
              >
                {text}
              </div>
            ))}
          </div>

          {/* Form area - client component */}
          <div className="max-w-sm">
            <CenterCardEarlyAccessForm />
          </div>
        </div>
      </div>
    </div>
  );
};
