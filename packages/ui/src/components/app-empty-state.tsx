import { AppBadge } from "./app-badge";

interface AppEmptyStateProps {
  description: string;
  prompt?: string;
  title: string;
}

export function AppEmptyState({
  title,
  description,
  prompt = "What can I do for you?",
}: AppEmptyStateProps) {
  return (
    <div className="mb-6 px-3">
      <AppBadge description={description} title={title} />
      <p className="text-2xl">{prompt}</p>
    </div>
  );
}
