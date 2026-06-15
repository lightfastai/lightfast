import { Loader2 } from "lucide-react";

export default function MembersLoading() {
  return (
    <div
      aria-label="Loading members"
      className="flex min-h-40 items-center justify-center"
      role="status"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
