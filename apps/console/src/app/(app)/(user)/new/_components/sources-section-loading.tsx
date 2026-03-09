/**
 * Loading skeleton for Sources accordion section
 * Displayed while connection data is being fetched
 */
export function SourcesSectionLoading() {
  return (
    <div className="w-full divide-y rounded-lg border">
      {/* GitHub skeleton */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </div>
      {/* Vercel skeleton */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </div>
      {/* Linear skeleton */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
