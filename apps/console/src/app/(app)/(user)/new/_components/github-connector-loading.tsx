/**
 * Loading skeleton for GitHub connector section
 * Displayed while GitHub integration data is being fetched
 */
export function GitHubConnectorLoading() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="h-12 w-12 mx-auto mb-4 bg-muted animate-pulse rounded-full" />
      <div className="h-5 w-64 mx-auto mb-4 bg-muted animate-pulse rounded" />
      <div className="h-10 w-40 mx-auto bg-muted animate-pulse rounded" />
    </div>
  );
}
