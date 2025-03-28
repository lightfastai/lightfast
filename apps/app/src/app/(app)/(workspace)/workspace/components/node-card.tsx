import type { LucideIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

interface NodeCardProps {
  title: string;
  icon: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}

export function NodeCard({
  title,
  icon: Icon,
  className,
  children,
}: NodeCardProps) {
  return (
    <div className={cn("rounded-lg border p-2 shadow-sm", className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <h3 className="font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
