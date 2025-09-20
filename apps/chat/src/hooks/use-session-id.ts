"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { uuidv4 } from "@repo/lib";

/**
 * Hook to manage session ID generation and retrieval based on pathname and search params.
 * 
 * Behavior:
 * - On /new: Generates a fresh session ID
 * - On /{sessionId}: Extracts and returns the session ID from URL
 * - Generates new ID when navigating back to /new
 * - Generates new ID when switching between temporary and permanent modes
 * 
 * @returns Object containing sessionId and isNewSession flag
 */
export function useSessionId() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Parse the pathname to determine current state
	const pathInfo = useMemo(() => {
		if (pathname === "/new") {
			return { type: "new" as const, id: null };
		}

		// Check if we've navigated to a session ID (after first message)
		const sessionIdRegex = /^\/([a-f0-9-]+)$/;
		const match = sessionIdRegex.exec(pathname);
		if (match) {
			return { type: "session" as const, id: match[1] };
		}

		return { type: "new" as const, id: null };
	}, [pathname]);

	// Generate a fresh session ID when on /new, including when search params change
	const sessionId = useMemo(() => {
		if (pathInfo.type === "session" && pathInfo.id) {
			// Use the ID from URL when we've already created a session
			return pathInfo.id;
		}
		// Generate a new ID for /new (search params included in dependency to reset on mode change)
		return uuidv4();
	}, [pathInfo, searchParams]);

	// Determine if this is a new session that needs creation
	const isNewSession = pathInfo.type === "new";

	return {
		sessionId,
		isNewSession,
	};
}