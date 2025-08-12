import { AppBadge } from "./app-badge";

interface AppEmptyStateProps {
	title: string;
	description: string;
	prompt?: string;
}

export function AppEmptyState({ 
	title, 
	description, 
	prompt = "What can I do for you?" 
}: AppEmptyStateProps) {
	return (
		<div className="mb-6 px-3">
			<AppBadge title={title} description={description} />
			<p className="text-2xl">{prompt}</p>
		</div>
	);
}