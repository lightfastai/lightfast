export function ChatBottomSection({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative">
			{/* Gradient fade overlay */}
			<div className="absolute -top-24 left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />

			{/* Chat Input */}
			<div className="relative bg-background pb-4 px-6">
				{children}
				<p className="text-xs text-muted-foreground text-center mt-2">
					This is an experiment by Lightfast. Use with discretion.
				</p>
			</div>
		</div>
	);
}
