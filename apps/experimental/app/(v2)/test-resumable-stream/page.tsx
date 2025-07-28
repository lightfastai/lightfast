"use client";

import { useResumableStream, useStreamMessages } from "@lightfast/ai/v2/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

export default function TestResumableStreamPage() {
	const [prompt, setPrompt] = useState("Tell me a short story about a robot learning to paint.");
	const [pendingSessionId, setPendingSessionId] = useState<string>();
	const [isGenerating, setIsGenerating] = useState(false);

	// Use the resumable stream hook
	const { messages, status, error, sessionId, reconnect, clear } = useResumableStream(pendingSessionId);

	// Extract just the text content
	const content = useStreamMessages(messages, "chunk");

	// Extract metadata messages
	const metadata = useStreamMessages(messages, "metadata");
	const lastMetadata = metadata[metadata.length - 1];

	// Start generation
	const handleGenerate = async () => {
		try {
			setIsGenerating(true);
			const response = await fetch("/api/v2/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});

			if (!response.ok) {
				throw new Error("Failed to start generation");
			}

			const data = await response.json();
			setPendingSessionId(data.sessionId);
		} catch (err) {
			console.error("Generation error:", err);
		} finally {
			setIsGenerating(false);
		}
	};

	// Clear and reset
	const handleClear = () => {
		clear();
		setPendingSessionId(undefined);
	};

	return (
		<div className="container mx-auto p-8 max-w-4xl">
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Resumable LLM Stream Test</CardTitle>
					<CardDescription>
						Test the resilient streaming architecture. Try refreshing the page or disconnecting your network while streaming!
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Input Section */}
					<div className="space-y-2">
						<Label htmlFor="prompt">Prompt</Label>
						<Input
							id="prompt"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Enter your prompt..."
							disabled={isGenerating || status === "connected"}
						/>
					</div>

					{/* Control Buttons */}
					<div className="flex gap-2">
						<Button
							onClick={handleGenerate}
							disabled={isGenerating || status === "connected"}
						>
							{isGenerating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Starting...
								</>
							) : (
								"Generate"
							)}
						</Button>

						{status === "disconnected" && (
							<Button onClick={reconnect} variant="secondary">
								<RefreshCw className="mr-2 h-4 w-4" />
								Reconnect
							</Button>
						)}

						{(content || sessionId) && (
							<Button onClick={handleClear} variant="destructive">
								<Trash2 className="mr-2 h-4 w-4" />
								Clear
							</Button>
						)}
					</div>

					{/* Status Section */}
					<div className="rounded-lg bg-muted p-4 space-y-2">
						<div className="text-sm space-y-1">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status:</span>
								<StatusBadge status={status} />
							</div>
							{sessionId && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Session ID:</span>
									<code className="text-xs">{sessionId}</code>
								</div>
							)}
							{lastMetadata && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Stream Status:</span>
									<span className="font-medium">{lastMetadata.status}</span>
								</div>
							)}
							{error && (
								<div className="flex justify-between text-destructive">
									<span>Error:</span>
									<span>{error.message}</span>
								</div>
							)}
						</div>
					</div>

					{/* Content Section */}
					{content && (
						<div className="rounded-lg border p-4">
							<div className="prose prose-sm max-w-none">
								{content}
							</div>
						</div>
					)}

					{/* Debug Section */}
					<details className="text-xs">
						<summary className="cursor-pointer text-muted-foreground">Debug Info</summary>
						<pre className="mt-2 rounded bg-muted p-2 overflow-auto">
							{JSON.stringify({ messages, status, sessionId }, null, 2)}
						</pre>
					</details>
				</CardContent>
			</Card>

			{/* Instructions */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Test Scenarios</CardTitle>
				</CardHeader>
				<CardContent>
					<ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
						<li>Click "Generate" to start a stream</li>
						<li>While streaming, refresh the page - the stream should resume automatically</li>
						<li>Try disconnecting your network (airplane mode) and reconnecting</li>
						<li>Open the same page in another tab - both should show the same stream</li>
						<li>Close the tab and reopen - if the stream is still running, it will resume</li>
					</ol>
				</CardContent>
			</Card>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const variants: Record<string, { color: string; label: string }> = {
		connecting: { color: "text-yellow-600", label: "Connecting..." },
		connected: { color: "text-green-600", label: "Connected" },
		disconnected: { color: "text-orange-600", label: "Disconnected" },
		error: { color: "text-red-600", label: "Error" },
		completed: { color: "text-blue-600", label: "Completed" },
	};

	const variant = variants[status] || { color: "text-gray-600", label: status };

	return (
		<span className={`font-medium ${variant.color}`}>
			{variant.label}
		</span>
	);
}