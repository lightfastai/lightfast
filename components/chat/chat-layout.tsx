import { ChatHeader } from "./chat-header";

export function ChatLayout({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex h-screen flex-col relative">
			<ChatHeader />
			{children}
		</main>
	);
}
