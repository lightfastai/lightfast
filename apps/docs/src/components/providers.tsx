"use client";

import { RootProvider } from "fumadocs-ui/provider";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const SearchDialog = dynamic(
	() => import("fumadocs-ui/components/dialog/search-default"),
);

interface ProvidersProps {
	children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
	return (
		<RootProvider
			search={{
				enabled: true,
				SearchDialog,
				api: "/docs/api/search", // API path with basePath
				hotKey: [
					{
						display: "K",
						key: "k",
					},
				],
				placeholder: "Search documentation...",
			}}
		>
			{children}
		</RootProvider>
	);
}