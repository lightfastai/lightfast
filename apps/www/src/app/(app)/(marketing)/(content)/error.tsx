"use client";

export default function ContentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="-mt-[var(--content-pt)] flex h-screen flex-col items-center justify-center text-center">
      <h1 className="font-semibold text-7xl tracking-tight">500</h1>
      <p className="mt-4 mb-8 text-muted-foreground">Internal Server Error</p>
      <button
        className="text-muted-foreground text-sm underline underline-offset-4 transition-colors hover:text-foreground"
        onClick={reset}
      >
        Try again
      </button>
    </div>
  );
}
