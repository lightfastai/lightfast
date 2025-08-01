import { ChatInterface } from "~/components/playground/chat-interface";
import { AnalyticsInterface } from "~/components/playground/analytics-interface";

export default function PlaygroundPage() {
  return (
    <div className="flex h-full w-full">
      {/* Left side - Chat Interface */}
      <div className="flex-1 border-r border-muted/30">
        <ChatInterface />
      </div>

      {/* Right side - Analytics Interface */}
      <div className="flex-1">
        <AnalyticsInterface />
      </div>
    </div>
  );
}