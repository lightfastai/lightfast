import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function SidebarSkeleton() {
	return (
		<div className="w-64 max-w-64 border-r border-muted/30 flex flex-col">
			{/* Header skeleton */}
			<div className="p-4 border-b border-muted/30">
				<div className="flex items-center gap-2">
					<Skeleton className="h-6 w-6" />
					<Skeleton className="h-4 w-32" />
				</div>
			</div>
			
			{/* New chat button skeleton */}
			<div className="p-4">
				<Skeleton className="h-8 w-full" />
			</div>
			
			{/* Sessions list skeleton */}
			<div className="flex-1 px-4 space-y-2">
				{Array.from({ length: 8 }).map((_, i) => (
					<Skeleton key={i} className="h-8 w-full" />
				))}
			</div>
			
			{/* Footer skeleton */}
			<div className="p-4 border-t border-muted/30">
				<Skeleton className="h-8 w-full" />
			</div>
		</div>
	);
}