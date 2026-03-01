export function SourcesListLoading() {
	return (
		<div className="w-full rounded-lg border divide-y">
			{[1, 2, 3, 4].map((index) => (
				<div
					key={index}
					className="flex items-center justify-between px-4 py-3"
				>
					<div className="flex items-center gap-3">
						<div className="h-5 w-5 bg-muted animate-pulse rounded" />
						<div className="h-4 w-16 bg-muted animate-pulse rounded" />
					</div>
					<div className="h-4 w-4 bg-muted animate-pulse rounded" />
				</div>
			))}
		</div>
	);
}
