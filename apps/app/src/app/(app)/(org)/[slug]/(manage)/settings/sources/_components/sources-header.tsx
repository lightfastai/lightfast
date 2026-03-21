/**
 * Sources Settings Header (Server Component)
 *
 * Static header for sources settings page.
 * Rendered on server for optimal performance.
 */
export function SourcesHeader() {
  return (
    <div>
      <h2 className="font-medium font-pp text-2xl text-foreground">Sources</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Manage your team's connected integrations and data sources.
      </p>
    </div>
  );
}
