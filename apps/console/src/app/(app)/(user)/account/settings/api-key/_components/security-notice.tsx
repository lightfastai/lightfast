/**
 * Security Best Practices Notice (Server Component)
 *
 * Static security guidelines displayed at the bottom of the API key settings page.
 */
export function SecurityNotice() {
	return (
		<div className="p-4 bg-muted/50 border border-border rounded-lg">
			<h3 className="text-sm font-medium text-foreground mb-2">
				Security Best Practices
			</h3>
			<ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
				<li>
					Never share your API keys publicly or commit them to version control
				</li>
				<li>Rotate your keys regularly and revoke unused keys</li>
				<li>
					Use different keys for different environments (dev, staging, production)
				</li>
				<li>
					Store keys securely using environment variables or secret management
					tools
				</li>
			</ul>
		</div>
	);
}
