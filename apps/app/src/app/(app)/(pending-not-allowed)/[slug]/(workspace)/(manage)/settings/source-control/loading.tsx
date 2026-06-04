import { Loader2 } from "lucide-react";

export default function SourceControlLoading() {
  return (
    <div
      aria-label="Loading source control"
      className="flex min-h-40 items-center justify-center"
      role="status"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
