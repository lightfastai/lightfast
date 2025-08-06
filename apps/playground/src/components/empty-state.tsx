import { PlaygroundBadge } from "./playground-badge";

export function EmptyState() {
  return (
    <div className="mb-6 px-3">
      <PlaygroundBadge />
      <p className="text-2xl">What can I do for you?</p>
    </div>
  );
}