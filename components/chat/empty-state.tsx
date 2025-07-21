import { ExperimentalBadge } from "./experimental-badge";

export function EmptyState() {
	return (
		<div className="mb-6">
			<ExperimentalBadge />
			<p className="text-2xl">What can I do for you?</p>
		</div>
	);
}
