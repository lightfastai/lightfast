"use client";

interface SearchEmptyStateProps {
  message: string;
}

export function SearchEmptyState({ message }: SearchEmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center rounded-sm border border-border/50 bg-card">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
