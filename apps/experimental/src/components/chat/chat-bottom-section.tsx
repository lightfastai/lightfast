export function ChatBottomSection({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative">
			{/* Chat Input container with gradient */}
			<div className="relative bg-background pb-4">
				{children}
			</div>
		</div>
	);
}
