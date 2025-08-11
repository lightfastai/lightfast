import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

interface EmptyStateProps {
  className?: string;
}

export function EmptyState({ className }: EmptyStateProps) {
  return (
    <ScrollArea className={className}>
      <div className="px-3 py-8 text-center text-muted-foreground">
        <p className="group-data-[collapsible=icon]:hidden text-xs">
          No conversations yet
        </p>
        <p className="group-data-[collapsible=icon]:hidden text-xs mt-1 opacity-75">
          Start a new chat to begin
        </p>
      </div>
    </ScrollArea>
  );
}