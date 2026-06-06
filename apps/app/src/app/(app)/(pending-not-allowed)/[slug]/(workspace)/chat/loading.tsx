import { Loader2 } from "lucide-react";

export default function ChatLoading() {
  return (
    <div
      aria-label="Loading chat"
      className="flex h-full min-h-0 w-full items-center justify-center bg-background"
      role="status"
    >
      <Loader2
        aria-hidden="true"
        className="size-6 animate-spin text-muted-foreground"
      />
    </div>
  );
}
