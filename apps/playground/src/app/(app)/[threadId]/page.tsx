import { PlaygroundInterface } from "~/components/playground-interface";

interface PlaygroundThreadPageProps {
  params: Promise<{
    threadId: string;
  }>;
}

export default async function PlaygroundThreadPage({ params }: PlaygroundThreadPageProps) {
  const { threadId } = await params;

  // TODO: In a real app, you would fetch existing messages here
  // For now, we'll pass empty messages
  const messages: any[] = [];

  return (
    <PlaygroundInterface threadId={threadId} initialMessages={messages} />
  );
}