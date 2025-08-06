import { Suspense } from "react";
import { PlaygroundContent } from "~/components/playground-content";
import { EmptyState } from "~/components/empty-state";
import { uuidv4 } from "~/lib/uuid";

/**
 * New playground page at /playground
 * Generates UUID server-side and renders playground interface
 * URL will change to /playground/[threadId] after first message
 */
export default function PlaygroundPage() {
  // Generate a new thread ID server-side
  const threadId = uuidv4();

  return (
    <Suspense fallback={null}>
      <PlaygroundContent threadId={threadId}>
        <EmptyState />
      </PlaygroundContent>
    </Suspense>
  );
}