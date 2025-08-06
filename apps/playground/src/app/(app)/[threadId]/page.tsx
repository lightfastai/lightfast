import { Suspense } from "react";
import { PlaygroundInterface } from "~/components/playground-interface";
import { getMessages } from "~/lib/get-messages";

interface PlaygroundThreadPageProps {
  params: Promise<{
    threadId: string;
  }>;
}

/**
 * Existing chat page at /playground/[threadId]
 * Renders the same playground interface with existing messages
 */
export default async function PlaygroundThreadPage({ params }: PlaygroundThreadPageProps) {
  const { threadId } = await params;

  // Fetch existing messages from Redis
  const messages = await getMessages(threadId);

  // Wrap in Suspense to ensure proper hydration timing
  return (
    <Suspense fallback={null}>
      <PlaygroundInterface threadId={threadId} initialMessages={messages} />
    </Suspense>
  );
}