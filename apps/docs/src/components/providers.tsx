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
				options: {
					api: "/docs/api/search", // Full path needed for multizone with basePath
				},
				hotKey: [
					{
						display: "K",
						key: "k",
					},
				],
			}}
		>
			{children}
		</RootProvider>
	);
}

