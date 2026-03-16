"use client";

interface SearchEmptyStateProps {
  message: string;
}

export function SearchEmptyState({ message }: SearchEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-border/50 bg-card/40 backdrop-blur-md">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
