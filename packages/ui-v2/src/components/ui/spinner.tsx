import { cn } from "@repo/ui-v2/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";

type SpinnerProps = Omit<
  React.ComponentProps<typeof HugeiconsIcon>,
  "aria-label" | "icon" | "role" | "strokeWidth"
>;

function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={2}
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
