export function ChatBottomSection({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative">
			{/* Chat Input container with gradient */}
			<div className="relative bg-background pb-4">
				{/* Gradient fade overlay - constrained to max-w-3xl to match input */}
				<div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none">
					<div className="max-w-3xl mx-auto relative h-full">
						<div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
					</div>
				</div>

				{children}
				<div className="max-w-3xl mx-auto">
					<p className="text-xs text-muted-foreground text-center mt-2">
						This is an experiment by Lightfast. Use with discretion.
					</p>
				</div>
			</div>
		</div>
	);
}
