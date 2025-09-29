"use client";

import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	useEffect,
} from "react";
import { usePathname } from "next/navigation";

interface SidebarNavigationState {
	pendingSessionId: string | null;
	setPendingSessionId: (sessionId: string | null) => void;
}

const SidebarNavigationContext = createContext<SidebarNavigationState | null>(null);

interface SidebarNavigationProviderProps {
	children: React.ReactNode;
}

export function SidebarNavigationProvider({
	children,
}: SidebarNavigationProviderProps) {
	const pathname = usePathname();
	const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

	useEffect(() => {
		if (!pendingSessionId) return;

		const matches = pendingSessionId === "new"
			? pathname === "/" || pathname.startsWith("/new")
			: pathname.includes(pendingSessionId);

		if (matches) {
			setPendingSessionId(null);
		}
	}, [pathname, pendingSessionId]);

	const setPending = useCallback((sessionId: string | null) => {
		setPendingSessionId(sessionId);
	}, []);

	const value = useMemo(
		() => ({ pendingSessionId, setPendingSessionId: setPending }),
		[pendingSessionId, setPending],
	);

	return (
		<SidebarNavigationContext.Provider value={value}>
			{children}
		</SidebarNavigationContext.Provider>
	);
}

export function useSidebarNavigation() {
	const ctx = useContext(SidebarNavigationContext);
	if (!ctx) {
		throw new Error(
			"useSidebarNavigation must be used within a SidebarNavigationProvider",
		);
	}
	return ctx;
}
