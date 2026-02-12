"use client";

export default function ContentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-screen -mt-[var(--content-pt)] flex flex-col items-center justify-center text-center">
      <h1 className="text-7xl font-semibold tracking-tight">500</h1>
      <p className="text-muted-foreground mt-4 mb-8">Internal Server Error</p>
      <button
        onClick={reset}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
