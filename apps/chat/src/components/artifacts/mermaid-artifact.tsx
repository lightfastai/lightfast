import { Artifact } from "./create-artifact";
import { useState, useEffect, useRef } from "react";
import { CopyIcon, MessageIcon } from "./icons";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Metadata {
	// Empty for now - can be extended later for diagram metadata
}

// Mermaid configuration optimized for dark theme
const MERMAID_CONFIG = {
	theme: "dark" as const,
	themeVariables: {
		primaryColor: "#3b82f6", // blue-500
		primaryTextColor: "#ffffff", // white
		primaryBorderColor: "#1e40af", // blue-800
		lineColor: "#6b7280", // gray-500
		secondaryColor: "#1f2937", // gray-800
		tertiaryColor: "#374151", // gray-700
		background: "#0f172a", // slate-900
		mainBkg: "#1e293b", // slate-800
		secondBkg: "#334155", // slate-700
		tertiaryTextColor: "#cbd5e1", // slate-300
	},
	flowchart: {
		useMaxWidth: true,
		htmlLabels: true,
		curve: "basis" as const,
	},
	sequence: {
		useMaxWidth: true,
		wrap: true,
		width: 150,
	},
	gantt: {
		useMaxWidth: true,
	},
	startOnLoad: false, // We'll initialize manually
	securityLevel: "loose" as const,
};

// Mermaid Diagram Component
interface MermaidDiagramProps {
	content: string;
	isStreaming?: boolean;
}

function MermaidDiagram({ content, isStreaming = false }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [diagramId, setDiagramId] = useState<string>("");

	// Generate unique ID for each diagram
	useEffect(() => {
		setDiagramId(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
	}, []);

	// Initialize and render mermaid diagram
	useEffect(() => {
		if (!content.trim() || !containerRef.current || !diagramId) {
			return;
		}

		let isMounted = true;

		const renderDiagram = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Dynamic import to avoid SSR issues
				const mermaid = await import("mermaid");

				// Initialize mermaid with our config
				mermaid.default.initialize(MERMAID_CONFIG);

				// Clear previous content
				if (containerRef.current) {
					containerRef.current.innerHTML = "";
				}

				// Validate syntax first
				try {
					await mermaid.default.parse(content);
				} catch (parseError) {
					throw new Error(
						`Invalid Mermaid syntax: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
					);
				}

				// Render the diagram
				const { svg } = await mermaid.default.render(diagramId, content);

				// Insert rendered SVG if component is still mounted
				if (isMounted && containerRef.current) {
					containerRef.current.innerHTML = svg;
					setIsLoading(false);
				}
			} catch (err) {
				if (isMounted) {
					const errorMessage =
						err instanceof Error ? err.message : "Failed to render diagram";
					setError(errorMessage);
					setIsLoading(false);

					// Show raw content as fallback
					if (containerRef.current) {
						containerRef.current.innerHTML = `
              <div class="p-4 bg-red-950/20 border border-red-500/30 rounded">
                <p class="text-red-400 text-sm font-medium mb-2">Mermaid Render Error:</p>
                <p class="text-red-300 text-xs mb-3">${errorMessage}</p>
                <pre class="text-gray-300 text-xs overflow-x-auto"><code>${content}</code></pre>
              </div>
            `;
					}
				}
			}
		};

		// Debounce rendering during streaming
		const timeoutId = setTimeout(
			() => {
				renderDiagram();
			},
			isStreaming ? 500 : 100,
		);

		return () => {
			isMounted = false;
			clearTimeout(timeoutId);
		};
	}, [content, diagramId, isStreaming]);

	return (
		<div className="relative min-h-[200px]">
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			)}

			<div
				ref={containerRef}
				className={`mermaid-container ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
				style={{
					// Ensure proper SVG scaling
					width: "100%",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			/>

			{/* Streaming indicator */}
			{isStreaming && !error && (
				<div className="absolute top-2 right-2 bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
					Generating...
				</div>
			)}
		</div>
	);
}

export const mermaidArtifact = new Artifact<"mermaid", Metadata>({
	kind: "mermaid",
	description:
		"Useful for creating diagrams, flowcharts, and visual representations.",
	initialize: ({ setMetadata }) => {
		setMetadata({});
	},
	onStreamPart: ({ streamPart, setArtifact }) => {
		if ((streamPart as { type: string }).type === "data-mermaidDelta") {
			setArtifact((draftArtifact) => {
				const newContent =
					draftArtifact.content + (streamPart as { data: string }).data;
				return {
					...draftArtifact,
					content: newContent,
					isVisible:
						draftArtifact.status === "streaming" &&
						newContent.length > 50 &&
						newContent.length < 60
							? true
							: draftArtifact.isVisible,
					status: "streaming",
				};
			});
		}
	},
	content: ({
		metadata: _metadata,
		setMetadata: _setMetadata,
		content,
		status,
		...props
	}) => {
		const isStreaming = status === "streaming";

		return (
			<div className="px-1">
				<div className="border rounded-lg bg-background/50 overflow-hidden p-4">
					<MermaidDiagram content={content} isStreaming={isStreaming} />
				</div>
			</div>
		);
	},
	actions: [
		{
			icon: <CopyIcon className="size-4" />,
			description: "Copy diagram code to clipboard",
			onClick: () => {
				// This will be handled by the ArtifactViewer component
				// Left as placeholder for compatibility
			},
		},
	],
	toolbar: [
		{
			icon: <MessageIcon className="size-4" />,
			description: "Edit diagram",
			onClick: ({ sendMessage }) => {
				sendMessage({
					role: "user",
					parts: [
						{
							type: "text",
							text: "Please modify this Mermaid diagram to improve its structure, add more details, or enhance its visual clarity",
						},
					],
				});
			},
		},
	],
});

