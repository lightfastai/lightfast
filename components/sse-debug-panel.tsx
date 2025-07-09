"use client";

import { Download, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SSEDebugEvent {
	id: string;
	timestamp: string;
	type: string;
	message: string;
	metadata?: any;
	raw?: string;
}

interface SSEDebugPanelProps {
	chatId: string | null;
	show?: boolean;
}

export function SSEDebugPanel({ chatId, show = false }: SSEDebugPanelProps) {
	const [events, setEvents] = useState<SSEDebugEvent[]>([]);
	const [isPaused, setIsPaused] = useState(false);
	const [filter, setFilter] = useState<string>("");

	useEffect(() => {
		if (!chatId || !show) return;

		const eventSource = new EventSource(`/api/investigation/updates?chatId=${chatId}`);

		eventSource.onmessage = (event) => {
			if (isPaused) return;

			try {
				const data = JSON.parse(event.data);
				const debugEvent: SSEDebugEvent = {
					id: `event-${Date.now()}-${Math.random()}`,
					timestamp: new Date().toISOString(),
					type: data.type || "unknown",
					message: data.message || "No message",
					metadata: data.metadata,
					raw: event.data,
				};

				setEvents((prev) => [...prev.slice(-99), debugEvent]); // Keep last 100 events
			} catch (err) {
				console.error("Debug panel: Error parsing SSE", err);
			}
		};

		return () => {
			eventSource.close();
		};
	}, [chatId, show, isPaused]);

	const filteredEvents = events.filter(
		(event) => !filter || event.type.includes(filter) || event.message.toLowerCase().includes(filter.toLowerCase()),
	);

	const clearEvents = () => setEvents([]);

	const exportEvents = () => {
		const dataStr = JSON.stringify(events, null, 2);
		const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

		const exportFileDefaultName = `sse-events-${chatId}-${Date.now()}.json`;

		const linkElement = document.createElement("a");
		linkElement.setAttribute("href", dataUri);
		linkElement.setAttribute("download", exportFileDefaultName);
		linkElement.click();
	};

	if (!show || !chatId) return null;

	return (
		<Card className="w-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm">SSE Debug Panel</CardTitle>
					<div className="flex items-center gap-2">
						<input
							type="text"
							placeholder="Filter events..."
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							className="px-2 py-1 text-xs border rounded"
						/>
						<Button size="sm" variant="ghost" onClick={() => setIsPaused(!isPaused)}>
							{isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
						</Button>
						<Button size="sm" variant="ghost" onClick={exportEvents} disabled={events.length === 0}>
							<Download className="h-3 w-3" />
						</Button>
						<Button size="sm" variant="ghost" onClick={clearEvents} disabled={events.length === 0}>
							<Trash2 className="h-3 w-3" />
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-64 w-full">
					<div className="space-y-1 text-xs font-mono">
						{filteredEvents.length === 0 ? (
							<div className="text-muted-foreground text-center py-4">No events yet...</div>
						) : (
							filteredEvents.map((event) => (
								<div
									key={event.id}
									className={`p-2 rounded border ${
										event.type === "error"
											? "border-red-500/20 bg-red-500/5"
											: event.type === "success"
												? "border-green-500/20 bg-green-500/5"
												: event.type === "info"
													? "border-blue-500/20 bg-blue-500/5"
													: "border-gray-500/20 bg-gray-500/5"
									}`}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<span className="text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
												<span
													className={`px-1 py-0.5 rounded text-xs ${
														event.type === "error"
															? "bg-red-500/20 text-red-500"
															: event.type === "success"
																? "bg-green-500/20 text-green-500"
																: event.type === "info"
																	? "bg-blue-500/20 text-blue-500"
																	: "bg-gray-500/20 text-gray-500"
													}`}
												>
													{event.type}
												</span>
											</div>
											<div className="mt-1">{event.message}</div>
											{event.metadata && (
												<details className="mt-1">
													<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
														Metadata
													</summary>
													<pre className="mt-1 p-1 bg-black/10 rounded overflow-x-auto">
														{JSON.stringify(event.metadata, null, 2)}
													</pre>
												</details>
											)}
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</ScrollArea>
				<div className="mt-2 text-xs text-muted-foreground">
					Showing {filteredEvents.length} of {events.length} events
					{isPaused && " (Paused)"}
				</div>
			</CardContent>
		</Card>
	);
}
