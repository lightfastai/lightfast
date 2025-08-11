import { ChatInterface } from "~/components/chat/chat-interface";

interface ThreadPageProps {
  params: {
    threadId: string;
  };
}

// Server component - no client-side logic
export default function ThreadPage({ params }: ThreadPageProps) {
  // ChatInterface will handle threadId detection from pathname
  return <ChatInterface />;
}