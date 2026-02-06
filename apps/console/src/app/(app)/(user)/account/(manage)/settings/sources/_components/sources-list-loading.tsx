/**
 * Sources List Loading Skeleton (Server Component)
 *
 * Loading state for sources list while data is being fetched.
 * Shows skeleton UI matching the final layout.
 */
export function SourcesListLoading() {
	return (
		<div className="border border-border rounded-lg overflow-hidden bg-card">
			{[1, 2, 3, 4].map((index) => (
				<div
					key={index}
					className={`flex items-center justify-between px-4 py-4 ${
						index !== 4 ? "border-b border-border" : ""
					}`}
				>
					<div className="flex items-center gap-4 flex-1">
						{/* Icon Skeleton */}
						<div className="w-10 h-10 rounded-lg bg-muted shrink-0 animate-pulse" />

						{/* Name and Description Skeleton */}
						<div className="flex-1 min-w-0 space-y-2">
							<div className="h-5 w-24 bg-muted rounded animate-pulse" />
							<div className="h-4 w-48 bg-muted rounded animate-pulse" />
						</div>
					</div>

					{/* Action Button Skeleton */}
					<div className="h-9 w-20 bg-muted rounded animate-pulse" />
				</div>
			))}
		</div>
	);
}
