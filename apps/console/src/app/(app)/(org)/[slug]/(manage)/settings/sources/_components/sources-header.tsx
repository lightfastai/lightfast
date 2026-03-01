/**
 * Sources Settings Header (Server Component)
 *
 * Static header for sources settings page.
 * Rendered on server for optimal performance.
 */
export function SourcesHeader() {
	return (
		<div>
			<h2 className="text-2xl font-pp font-medium text-foreground">Sources</h2>
			<p className="text-sm text-muted-foreground mt-1">
				Manage your team's connected integrations and data sources.
			</p>
		</div>
	);
}
