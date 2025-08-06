import { Suspense } from "react";
import { PlaygroundInterface } from "~/components/playground-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";

// Force dynamic rendering to ensure new UUID on each request
export const dynamic = 'force-dynamic';

/**
 * New playground page at /playground
 * Generates UUID server-side and renders playground interface
 * URL will change to /playground/[threadId] after first message
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