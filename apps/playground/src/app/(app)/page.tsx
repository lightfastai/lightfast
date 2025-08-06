import { Suspense } from "react";
import { PlaygroundPageWrapper } from "~/components/playground-page-wrapper";

/**
 * New playground page at /playground
 * Generates UUID client-side to ensure unique IDs in production
 * URL will change to /playground/[threadId] after first message
 */
export default function PlaygroundPage() {
  // Wrap in Suspense to ensure proper hydration timing
  return (
    <Suspense fallback={null}>
      <PlaygroundPageWrapper />
    </Suspense>
  );
}