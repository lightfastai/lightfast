"use client";

interface SearchEmptyStateProps {
  message: string;
}

export function SearchEmptyState({ message }: SearchEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full border rounded-md bg-card/40 backdrop-blur-md border-border/50">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
