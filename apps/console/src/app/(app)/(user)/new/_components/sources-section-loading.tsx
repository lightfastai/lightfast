/**
 * Loading skeleton for Sources accordion section
 * Displayed while connection data is being fetched
 */
export function SourcesSectionLoading() {
  return (
    <div className="w-full rounded-lg border divide-y">
      {/* GitHub skeleton */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </div>
      {/* Vercel skeleton */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-muted animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
