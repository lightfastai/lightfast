import { cn } from "@repo/ui/lib/utils";

export function WorkspaceSurface({
  children,
  className,
  variant = "contained",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "contained" | "flush";
}) {
  if (variant === "flush") {
    return (
      <div className={cn("min-h-full w-full bg-background", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 py-10", className)}>
      {children}
    </div>
  );
}
