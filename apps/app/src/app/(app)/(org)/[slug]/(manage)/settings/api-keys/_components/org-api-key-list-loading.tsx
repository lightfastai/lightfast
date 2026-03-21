/**
 * Organization API Key List Loading Skeleton (Server Component)
 *
 * Displayed while the API key list is being fetched.
 */
export function OrgApiKeyListLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded bg-muted" />
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            key={i}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-lg bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
