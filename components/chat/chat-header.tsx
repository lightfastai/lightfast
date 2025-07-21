import { NewChatButton } from "./new-chat-button";
import { UserDropdown } from "@/components/user-dropdown";

export function ChatHeader() {
	return (
		<div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between">
			<NewChatButton />
			<UserDropdown />
		</div>
	);
}
