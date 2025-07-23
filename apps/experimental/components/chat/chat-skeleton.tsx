export function ChatSkeleton() {
	return (
		<div className="flex h-full items-center justify-center p-6">
			<div className="w-full max-w-3xl space-y-4">
				<div className="animate-pulse">
					<div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
					<div className="h-8 bg-muted rounded w-3/4"></div>
				</div>
				<div className="animate-pulse">
					<div className="h-12 bg-muted rounded-lg"></div>
				</div>
			</div>
		</div>
	);
}
