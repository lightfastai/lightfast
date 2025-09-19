"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArtifactViewer } from "~/components/artifacts";
import type { UIArtifact } from "~/components/artifacts";
import type { ArtifactApiResponse } from "~/components/artifacts/types";

interface ArtifactPaneProps {
	artifact: UIArtifact;
	metadata: Record<string, unknown>;
	setMetadata: Dispatch<SetStateAction<Record<string, unknown>>>;
	hideArtifact: () => void;
	showArtifact: (artifactData: Partial<UIArtifact>) => void;
	fetchArtifact: (artifactId: string) => Promise<ArtifactApiResponse>;
	sessionId: string;
	isAuthenticated: boolean;
}

export function ArtifactPane({
	artifact,
	metadata,
	setMetadata,
	hideArtifact,
	showArtifact,
	fetchArtifact,
	sessionId,
	isAuthenticated,
}: ArtifactPaneProps) {
	const handleArtifactSelect = useCallback(
		async (artifactId: string) => {
			try {
				const artifactData = await fetchArtifact(artifactId);

				showArtifact({
					documentId: artifactData.id,
					title: artifactData.title,
					kind: artifactData.kind,
					content: artifactData.content,
					status: "idle",
					boundingBox: {
						top: 100,
						left: 100,
						width: 300,
						height: 200,
					},
				});
			} catch (error) {
				console.error("Failed to load artifact:", error);
			}
		},
		[fetchArtifact, showArtifact],
	);

	if (!isAuthenticated || !artifact.isVisible) {
		return null;
	}

	return (
		<div className="w-1/2 min-w-0 flex-shrink-0 overflow-hidden bg-background transition-opacity duration-300">
			<ArtifactViewer
				artifact={artifact}
				metadata={metadata}
				setMetadata={setMetadata}
				onClose={hideArtifact}
				sessionId={sessionId}
				_isAuthenticated={isAuthenticated}
				onArtifactSelect={handleArtifactSelect}
			/>
		</div>
	);
}
