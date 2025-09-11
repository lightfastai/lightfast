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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { List, Check, Copy } from "lucide-react";
import { useArtifactsQuery } from "~/hooks/use-artifacts-query";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";

interface ArtifactViewerProps {
	artifact: UIArtifact;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	metadata: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setMetadata: (metadata: any) => void;
	onClose: () => void;
	onSaveContent?: (content: string, debounce: boolean) => void;
	sessionId: string;
	onArtifactSelect?: (artifactId: string) => void;
}

export function ArtifactViewer({
	artifact,
	metadata,
	setMetadata,
	onClose,
	onSaveContent: _onSaveContent,
	sessionId,
	onArtifactSelect,
}: ArtifactViewerProps) {
	const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

	// Query artifacts for the current session
	const { data: sessionArtifacts = [], isLoading: isLoadingArtifacts } = useArtifactsQuery({
		sessionId,
	});

	// Hook for copy functionality with success state
	const { copyToClipboard, isCopied } = useCopyToClipboard({
		showToast: true,
		toastMessage: "Code copied to clipboard!",
	});

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
				<div className="flex items-center gap-2">
					{/* Artifacts list dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<ArtifactAction
								tooltip="View all artifacts in this session"
								icon={List}
								disabled={isLoadingArtifacts}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-64">
							{sessionArtifacts.length === 0 ? (
								<DropdownMenuItem disabled>
									No artifacts in this session
								</DropdownMenuItem>
							) : (
								sessionArtifacts.map((sessionArtifact) => (
									<DropdownMenuItem
										key={sessionArtifact.id}
										onClick={() => onArtifactSelect?.(sessionArtifact.id)}
										className="flex flex-col items-start gap-1 py-2"
									>
										<div className="font-medium text-sm">
											{sessionArtifact.title}
										</div>
										<div className="text-xs text-muted-foreground capitalize">
											{sessionArtifact.kind}
										</div>
									</DropdownMenuItem>
								))
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					<ArtifactTitle>{artifact.title}</ArtifactTitle>
				</div>
				<ArtifactActions>
					{/* Artifact actions */}
					{artifactDefinition.actions.map((action, index) => {
						// Special handling for copy action
						if (action.description === "Copy code to clipboard") {
							return (
								<ArtifactAction
									key={index}
									onClick={() => void copyToClipboard(artifact.content)}
									tooltip={action.description}
									className={isCopied ? "text-green-600" : ""}
								>
									{isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
								</ArtifactAction>
							);
						}

						// Default action rendering
						return (
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
						);
					})}

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
