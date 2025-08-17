"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
	const router = useRouter();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd+Shift+O or Ctrl+Shift+O for new chat
			if (e.key === "o" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
				e.preventDefault();
				router.push("/new");
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [router]);

	return null;
}