import { Suspense } from "react";
import { PlaygroundInterface } from "~/components/playground-interface";
import { getMessages } from "~/lib/get-messages";

interface PlaygroundSessionPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

/**
 * Existing chat page at /playground/[sessionId]
 * Renders the same playground interface with existing messages
 */
export default async function PlaygroundSessionPage({ params }: PlaygroundSessionPageProps) {
  const { sessionId } = await params;

  // Fetch existing messages from Redis
  const messages = await getMessages(sessionId);

  // Wrap in Suspense to ensure proper hydration timing
  return (
    <Suspense fallback={null}>
      <PlaygroundInterface sessionId={sessionId} initialMessages={messages} />
    </Suspense>
  );
}