export function BillingContentSkeleton() {
	return (
		<div className="space-y-6">
			{/* Plan Header Section Skeleton */}
			<div className="flex items-center gap-3 p-4 border rounded-lg bg-background">
				{/* Plan Icon */}
				<div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
					<div className="w-5 h-5 bg-muted rounded animate-pulse" />
				</div>

				{/* Plan Info */}
				<div className="flex-1 min-w-0 space-y-2">
					<div className="h-5 bg-muted rounded w-24 animate-pulse" />
					<div className="h-4 bg-muted rounded w-40 animate-pulse" />
				</div>

				{/* Right side content skeleton (for potential upgrade button) */}
				<div className="flex-shrink-0">
					<div className="h-8 bg-muted rounded w-20 animate-pulse" />
				</div>
			</div>

			{/* Payment Method Section Skeleton */}
			<div className="border rounded-lg bg-background">
				<div className="p-6">
					<div className="h-6 bg-muted rounded w-32 animate-pulse mb-4" />
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-5 h-5 bg-muted rounded animate-pulse" />
							<div className="h-4 bg-muted rounded w-32 animate-pulse" />
						</div>
						<div className="h-9 bg-muted rounded w-16 animate-pulse" />
					</div>
				</div>
			</div>

			{/* Payment History Section Skeleton */}
			<div className="border rounded-lg bg-background">
				<div className="p-6">
					<div className="h-6 bg-muted rounded w-32 animate-pulse mb-4" />
					<div className="space-y-3">
						{/* Table header skeleton */}
						<div className="grid grid-cols-4 gap-4">
							<div className="h-4 bg-muted rounded animate-pulse" />
							<div className="h-4 bg-muted rounded animate-pulse" />
							<div className="h-4 bg-muted rounded animate-pulse" />
							<div className="h-4 bg-muted rounded animate-pulse" />
						</div>
						{/* Table rows skeleton */}
						{[1, 2, 3].map((i) => (
							<div key={i} className="grid grid-cols-4 gap-4">
								<div className="h-4 bg-muted rounded animate-pulse" />
								<div className="h-4 bg-muted rounded animate-pulse" />
								<div className="h-4 bg-muted rounded animate-pulse" />
								<div className="h-6 bg-muted rounded w-16 animate-pulse" />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

