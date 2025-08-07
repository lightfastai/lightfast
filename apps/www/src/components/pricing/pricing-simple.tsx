export function PricingSimple() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
			{/* Left side */}
			<div className="space-y-4">
				<h2 className="text-2xl font-bold tracking-tight">
					Simple, Transparent Pricing
				</h2>
				<p className="text-sm text-muted-foreground">
					All latest AI models, share chats with friends, Secure & private. Free
					tier available with rate limits.
				</p>
			</div>

			{/* Right side - pricing */}
			<div className="flex items-center justify-end">
				<div className="space-y-2 text-right">
					<div className="flex items-baseline gap-2">
						<span className="text-5xl font-bold tracking-tight">$8</span>
						<span className="text-xl text-muted-foreground">USD/month</span>
					</div>
					<p className="text-sm text-muted-foreground">
						per user for Lightfast Chat
					</p>
				</div>
			</div>
		</div>
	);
}
