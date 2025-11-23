/**
 * API Key List Loading Skeleton (Server Component)
 *
 * Displayed while the API key list is being fetched.
 */
export function ApiKeyListLoading() {
	return (
		<div className="space-y-3">
			{[1, 2, 3].map((i) => (
				<div
					key={i}
					className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
				>
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted animate-pulse" />
						<div className="flex-1 min-w-0 space-y-2">
							<div className="h-5 w-32 bg-muted animate-pulse rounded" />
							<div className="h-4 w-48 bg-muted animate-pulse rounded" />
						</div>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-8 w-16 bg-muted animate-pulse rounded" />
						<div className="h-8 w-8 bg-muted animate-pulse rounded" />
					</div>
				</div>
			))}
		</div>
	);
}
