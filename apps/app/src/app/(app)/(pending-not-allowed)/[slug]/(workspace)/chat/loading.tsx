import { Loader2 } from "lucide-react";

export default function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
