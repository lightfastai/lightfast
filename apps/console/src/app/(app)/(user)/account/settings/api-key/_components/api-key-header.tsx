/**
 * API Key Settings Header (Server Component)
 *
 * Static header with title, description.
 * The Create API Key button is rendered in the client component.
 */
export function ApiKeyHeader() {
	return (
		<div className="flex items-center justify-between">
			<div>
				<h2 className="text-2xl font-semibold text-foreground">API Keys</h2>
				<p className="text-sm text-muted-foreground mt-2">
					Manage your API keys for programmatic access to Lightfast.
				</p>
			</div>
		</div>
	);
}
