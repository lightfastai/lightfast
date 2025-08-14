"use client";

interface ChatEmptyStateProps {
	prompt?: string;
}

export function ChatEmptyState({
	prompt = "What can I do for you?",
}: ChatEmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center">
			<p className="text-2xl font-medium font-semibold text-center">{prompt}</p>
		</div>
	);
}

