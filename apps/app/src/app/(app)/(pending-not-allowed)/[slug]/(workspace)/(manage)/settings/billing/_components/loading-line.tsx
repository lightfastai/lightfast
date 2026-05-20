import { Loader2 } from "lucide-react";

export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
