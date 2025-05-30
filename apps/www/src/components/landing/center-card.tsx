import { Icons } from "@repo/ui/components/icons";
import { cn } from "@repo/ui/lib/utils";

export const CenterCard = () => {
  return (
    <div
      className={cn(
        "bg-card border-border absolute overflow-hidden border shadow-2xl",
        "optimized-center-card",
      )}
    >
      {/* Text content (top-left, fades out) */}
      <div className="center-card-text absolute top-8 right-8 left-8">
        <p className="max-w-[400px] text-2xl font-bold">
          The intelligent creative copilot that simplifies the way you interact
          with applications like Blender, Unity, Fusion360 and more.
        </p>
      </div>

      {/* Logo (transforms from bottom-left to center) */}
      <div className="center-card-logo absolute flex items-center justify-center">
        <Icons.logoShort className="text-primary h-12 w-12" />
      </div>
    </div>
  );
};
