import { Suspense } from "react";
import { PlaygroundInterface } from "~/components/playground-interface";
import { uuidv4 } from "~/lib/uuid";

/**
 * New playground page at /
 * Generates UUID server-side and renders playground interface
 * URL will change to /[threadId] after first message
 */
export default function PlaygroundPage() {
  // Generate a new thread ID server-side
  const threadId = uuidv4();

  // Wrap in Suspense to ensure proper hydration timing
  return (
    <Suspense fallback={null}>
      <PlaygroundInterface threadId={threadId} initialMessages={[]} />
    </Suspense>
  );
}