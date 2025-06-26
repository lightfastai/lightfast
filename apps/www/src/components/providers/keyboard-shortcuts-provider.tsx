"use client";

import { useRouter } from "next/navigation";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

export function KeyboardShortcutsProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();

	// Add keyboard shortcut for new chat (Cmd/Ctrl+Shift+O)
	useKeyboardShortcut({
		key: "o",
		ctrlKey: true,
		metaKey: true,
		shiftKey: true,
		callback: () => {
			router.push("/chat");
		},
	});

	// Add keyboard shortcut for sidebar toggle (Cmd/Ctrl+B)
	useKeyboardShortcut({
		key: "b",
		ctrlKey: true,
		metaKey: true,
		callback: () => {
			// Toggle sidebar - this is handled by the sidebar component itself
			const event = new KeyboardEvent("keydown", {
				key: "b",
				ctrlKey: true,
				metaKey: true,
			});
			window.dispatchEvent(event);
		},
	});

	return <>{children}</>;
}
