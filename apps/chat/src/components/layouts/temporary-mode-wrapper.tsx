"use client";

import type { ReactNode } from "react";
import { useTemporaryMode } from "~/hooks/use-temporary-mode";

interface TemporaryModeWrapperProps {
	children: ReactNode;
}

// Provides a data attribute hook for Tailwind data-variants.
// Sets data-temp="true" when in temporary chat mode.
export function TemporaryModeWrapper({ children }: TemporaryModeWrapperProps) {
	const isTemporary = useTemporaryMode();
	return (
		<div
			data-temp={isTemporary ? "true" : "false"}
			className="lf-chat-root group flex h-screen w-full relative bg-transparent data-[temp=true]:bg-white data-[temp=true]:pt-14 data-[temp=true]:px-2 data-[temp=true]:pb-2 lg:data-[temp=true]:[--sidebar-width:0px]"
		>
			{children}
		</div>
	);
}
