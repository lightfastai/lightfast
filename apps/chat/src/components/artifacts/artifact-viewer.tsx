"use client";

import { useState } from "react";
import type { UIArtifact } from "./artifact";
import { artifactDefinitions } from "./artifact";
import {
	Artifact,
	ArtifactHeader,
	ArtifactTitle,
	ArtifactActions,
	ArtifactAction,
	ArtifactClose,
	ArtifactContent,
} from "@repo/ui/components/ai-elements/artifact";

interface ArtifactViewerProps {
	artifact: UIArtifact;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	metadata: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setMetadata: (metadata: any) => void;
	onClose: () => void;
	onSaveContent?: (content: string, debounce: boolean) => void;
}

export function ArtifactViewer({
	artifact,
	metadata,
	setMetadata,
	onClose,
	onSaveContent: _onSaveContent,
}: ArtifactViewerProps) {
	const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

	// We only support 'code' artifacts for now, so use the first (and only) definition
	const artifactDefinition = artifactDefinitions[0];

	if (!artifactDefinition) {
		return null; // Should never happen, but ensures type safety
	}

	const handleVersionChange = (type: "next" | "prev" | "toggle" | "latest") => {
		if (type === "latest") {
			setCurrentVersionIndex(0);
		}
		// For now, we only have one version
	};

	const isCurrentVersion = true; // For now, always current version

	return (
		<Artifact className="h-full w-full border-l border-zinc-200 dark:border-zinc-700">
			<ArtifactHeader>
				<ArtifactTitle>{artifact.title}</ArtifactTitle>
				<ArtifactActions>
					{/* Artifact actions */}
					{artifactDefinition.actions.map((action, index) => (
						<ArtifactAction
							key={index}
							onClick={() =>
								action.onClick({
									content: artifact.content,
									handleVersionChange,
									currentVersionIndex,
									isCurrentVersion,
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									metadata,
									setMetadata,
								})
							}
							disabled={action.isDisabled?.({
								content: artifact.content,
								handleVersionChange,
								currentVersionIndex,
								isCurrentVersion,
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
								metadata,
								setMetadata,
							})}
							tooltip={action.description}
						>
							{action.icon}
						</ArtifactAction>
					))}

					{/* Close button */}
					<ArtifactClose onClick={onClose} />
				</ArtifactActions>
			</ArtifactHeader>

			<ArtifactContent className="p-0">
				<artifactDefinition.content
					title={artifact.title}
					content={artifact.content}
					status={artifact.status}
					currentVersionIndex={currentVersionIndex}
					isInline={false}
					isCurrentVersion={isCurrentVersion}
					getDocumentContentById={() => artifact.content}
					isLoading={false}
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					metadata={metadata}
					setMetadata={setMetadata}
				/>
			</ArtifactContent>
		</Artifact>
	);
}
