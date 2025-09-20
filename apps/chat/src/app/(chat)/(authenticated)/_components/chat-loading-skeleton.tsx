import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function ChatLoadingSkeleton() {
	return (
		<div className="flex flex-col h-full bg-background">
			{/* Messages area skeleton - matches ChatMessages container exactly */}
			<div className="flex-1 relative min-h-0 overflow-hidden">
				<div className="absolute inset-0 overflow-y-auto">
					<div className="flex w-full flex-col">
						{/* User message - matches MessageItem structure */}
						<div className="pb-12 pt-3">
							<div className="mx-auto max-w-3xl px-4 flex justify-end">
								<div className="max-w-[80%] border border-muted/30 rounded-xl px-4 py-1 bg-transparent dark:bg-input/30">
									<div className="invisible">Welcome to Lightfast</div>
								</div>
							</div>
						</div>

						{/* Assistant message with thinking indicator */}
						<div className="pb-20">
							<div className="mx-auto max-w-3xl px-4 space-y-4">
								{/* Thinking indicator */}
								<div className="flex items-center gap-2">
									<Skeleton className="h-4 w-4 rounded-full" />
									<Skeleton className="h-3 w-12" />
								</div>

								{/* Assistant response text */}
								<div className="w-full px-4">
									<Skeleton className="h-4 w-full mb-2" />
									<Skeleton className="h-4 w-[90%] mb-2" />
									<Skeleton className="h-4 w-[85%] mb-2" />
									<Skeleton className="h-4 w-[40%] mb-2" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Empty space for input area - matches ChatInterface exactly */}
			<div className="relative bg-background">
				<div className="max-w-3xl mx-auto p-4">
					{/* Empty space matching ChatInput height */}
					<div className="h-24" />
				</div>
			</div>
		</div>
	);
}
