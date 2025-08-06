import { Suspense } from "react";
import { PlaygroundInterface } from "~/components/playground-interface";

interface PlaygroundThreadPageProps {
  params: Promise<{
    threadId: string;
  }>;
}

/**
 * Existing chat page at /[threadId]
 * Renders the same playground interface with existing messages
 */
export default async function PlaygroundThreadPage({ params }: PlaygroundThreadPageProps) {
  const { threadId } = await params;

  // TODO: In a real app, you would fetch existing messages here
  // For now, we'll pass empty messages
  const messages: Array<{
    id: string;
    content: string;
    role: "user" | "assistant";
  }> = [];

  // Wrap in Suspense to ensure proper hydration timing
  return (
    <Suspense fallback={null}>
      <PlaygroundInterface threadId={threadId} initialMessages={messages} />
    </Suspense>
  );
}