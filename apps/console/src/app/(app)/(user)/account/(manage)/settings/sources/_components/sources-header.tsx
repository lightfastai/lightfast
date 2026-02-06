/**
 * Sources Settings Header (Server Component)
 *
 * Static header for sources settings page.
 * Rendered on server for optimal performance.
 */
export function SourcesHeader() {
	return (
		<div>
			<h2 className="text-2xl font-semibold text-foreground">Sources</h2>
			<p className="text-base text-muted-foreground mt-1">
				Customize how you access your account. Link your Git profiles and set up
				passkeys for seamless, secure authentication.
			</p>
		</div>
	);
}
