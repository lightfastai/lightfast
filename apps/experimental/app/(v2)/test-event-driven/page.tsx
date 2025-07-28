"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bot, Calculator, Clock, Loader2, Play, RefreshCw, Settings, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Type definitions for V2 event-driven architecture
interface StreamEvent {
	id: string;
	type: 'chunk' | 'status' | 'event' | 'tool' | 'thinking' | 'error' | 'complete' | 'completion';
	content: string;
	metadata?: Record<string, any>;
	timestamp: string;
}

interface TestScenario {
	key: string;
	name: string;
	description: string;
	messages: Array<{ role: string; content: string }>;
	tools: string[];
}

export default function TestEventDrivenPage() {
	const [selectedScenario, setSelectedScenario] = useState<string>("simple");
	const [customPrompt, setCustomPrompt] = useState("");
	const [sessionId, setSessionId] = useState<string>();
	const [events, setEvents] = useState<StreamEvent[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
	const [isRunningTest, setIsRunningTest] = useState(false);
	const [scenarios, setScenarios] = useState<TestScenario[]>([]);
	const [error, setError] = useState<string>();
	
	const eventSourceRef = useRef<EventSource>();

	// Available test scenarios
	const defaultScenarios: TestScenario[] = [
		{
			key: "simple",
			name: "Simple Calculator",
			description: "Tests basic agent loop with calculator tool",
			messages: [{ role: "user", content: "What is 25 * 4?" }],
			tools: ["calculator"]
		},
		{
			key: "multiTool", 
			name: "Multi-Tool Test",
			description: "Tests multiple tool usage in sequence",
			messages: [{ role: "user", content: "What's the weather like and then calculate 15 * 3?" }],
			tools: ["weather", "calculator"]
		},
		{
			key: "custom",
			name: "Custom Prompt",
			description: "Use a custom prompt with available tools",
			messages: [],
			tools: ["calculator", "weather"]
		}
	];

	// Load available scenarios on mount
	useEffect(() => {
		setScenarios(defaultScenarios);
	}, []);

	// Clean up event source on unmount
	useEffect(() => {
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, []);

	const connectToStream = useCallback((sessionId: string) => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		setConnectionStatus('connecting');
		setError(undefined);

		const eventSource = new EventSource(`/api/v2/stream/${sessionId}`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setConnectionStatus('connected');
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				const streamEvent: StreamEvent = {
					id: event.lastEventId || Date.now().toString(),
					type: (event.type as any) || 'message',
					content: data.content || event.data,
					metadata: data,
					timestamp: new Date().toISOString()
				};
				setEvents(prev => [...prev, streamEvent]);
			} catch (err) {
				console.error('Failed to parse event:', err);
			}
		};

		// Handle specific event types including streaming chunks
		['chunk', 'status', 'event', 'tool', 'thinking', 'error', 'complete', 'completion', 'metadata'].forEach(eventType => {
			eventSource.addEventListener(eventType, (event) => {
				try {
					const data = JSON.parse(event.data);
					const streamEvent: StreamEvent = {
						id: event.lastEventId || Date.now().toString(),
						type: eventType as any,
						content: data.content || JSON.stringify(data),
						metadata: data,
						timestamp: new Date().toISOString()
					};
					setEvents(prev => [...prev, streamEvent]);

					if (eventType === 'complete' || eventType === 'completion' || 
						(eventType === 'metadata' && data.status === 'completed')) {
						setIsRunningTest(false);
					}
				} catch (err) {
					const streamEvent: StreamEvent = {
						id: event.lastEventId || Date.now().toString(),
						type: eventType as any,
						content: event.data,
						metadata: {},
						timestamp: new Date().toISOString()
					};
					setEvents(prev => [...prev, streamEvent]);
				}
			});
		});

		eventSource.onerror = (error) => {
			console.error('EventSource error:', error);
			setConnectionStatus('error');
			setError('Stream connection lost');
			setIsRunningTest(false);
		};
	}, []);

	const runTest = async () => {
		try {
			setIsRunningTest(true);
			setEvents([]);
			setError(undefined);

			const scenario = scenarios.find(s => s.key === selectedScenario);
			if (!scenario) {
				throw new Error('Selected scenario not found');
			}

			let messages = scenario.messages;
			if (selectedScenario === 'custom' && customPrompt) {
				messages = [{ role: "user", content: customPrompt }];
			}

			// Start the test scenario
			const response = await fetch(`/api/v2/test/${selectedScenario}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					messages,
					tools: scenario.tools 
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.details || `HTTP ${response.status}`);
			}

			const data = await response.json();
			setSessionId(data.sessionId);

			// Connect to the stream
			connectToStream(data.sessionId);

		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error');
			setIsRunningTest(false);
		}
	};

	const reconnect = () => {
		if (sessionId) {
			connectToStream(sessionId);
		}
	};

	const clearTest = () => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}
		setEvents([]);
		setSessionId(undefined);
		setConnectionStatus('disconnected');
		setIsRunningTest(false);
		setError(undefined);
	};

	const getEventIcon = (type: string) => {
		switch (type) {
			case 'chunk': return <Zap className="h-4 w-4" />;
			case 'status': return <Settings className="h-4 w-4" />;
			case 'event': return <Clock className="h-4 w-4" />;
			case 'tool': return <Calculator className="h-4 w-4" />;
			case 'thinking': return <Bot className="h-4 w-4" />;
			case 'error': return <AlertCircle className="h-4 w-4" />;
			case 'metadata': return <Settings className="h-4 w-4" />;
			default: return <Clock className="h-4 w-4" />;
		}
	};

	const getEventColor = (type: string) => {
		switch (type) {
			case 'chunk': return 'text-blue-600';
			case 'status': return 'text-green-600';
			case 'event': return 'text-gray-600';
			case 'tool': return 'text-purple-600';
			case 'thinking': return 'text-orange-600';
			case 'error': return 'text-red-600';
			case 'metadata': return 'text-teal-600';
			default: return 'text-gray-600';
		}
	};

	const selectedScenarioData = scenarios.find(s => s.key === selectedScenario);

	return (
		<div className="container mx-auto p-8 max-w-6xl">
			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bot className="h-6 w-6" />
						V2 Event-Driven Architecture Test
					</CardTitle>
					<CardDescription>
						Test the new event-driven agent architecture with Qstash, Redis streams, and real-time SSE
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Test Configuration */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="scenario">Test Scenario</Label>
							<Select value={selectedScenario} onValueChange={setSelectedScenario}>
								<SelectTrigger>
									<SelectValue placeholder="Select a test scenario" />
								</SelectTrigger>
								<SelectContent>
									{scenarios.map((scenario) => (
										<SelectItem key={scenario.key} value={scenario.key}>
											{scenario.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedScenarioData && (
								<p className="text-sm text-muted-foreground">
									{selectedScenarioData.description}
								</p>
							)}
						</div>

						{selectedScenario === 'custom' && (
							<div className="space-y-2">
								<Label htmlFor="custom-prompt">Custom Prompt</Label>
								<Input
									id="custom-prompt"
									value={customPrompt}
									onChange={(e) => setCustomPrompt(e.target.value)}
									placeholder="Enter your custom prompt..."
									disabled={isRunningTest}
								/>
							</div>
						)}
					</div>

					{/* Control Buttons */}
					<div className="flex gap-2">
						<Button 
							onClick={runTest} 
							disabled={isRunningTest || (selectedScenario === 'custom' && !customPrompt.trim())}
							className="flex items-center gap-2"
						>
							{isRunningTest ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Running Test...
								</>
							) : (
								<>
									<Play className="h-4 w-4" />
									Run Test
								</>
							)}
						</Button>

						{connectionStatus === 'error' && sessionId && (
							<Button onClick={reconnect} variant="secondary">
								<RefreshCw className="h-4 w-4 mr-2" />
								Reconnect
							</Button>
						)}

						{(events.length > 0 || sessionId) && (
							<Button onClick={clearTest} variant="destructive">
								<Trash2 className="h-4 w-4 mr-2" />
								Clear
							</Button>
						)}
					</div>

					{/* Status Bar */}
					<div className="rounded-lg bg-muted p-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Connection:</span>
								<ConnectionBadge status={connectionStatus} />
							</div>
							{sessionId && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Session:</span>
									<code className="text-xs bg-background px-2 py-1 rounded">{sessionId}</code>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-muted-foreground">Events:</span>
								<span className="font-medium">{events.length}</span>
							</div>
						</div>
						{error && (
							<div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
								<strong>Error:</strong> {error}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Event Stream Display */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Events Timeline */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Event Timeline</CardTitle>
						<CardDescription>Real-time events from the agent loop</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3 max-h-96 overflow-y-auto">
							{events.length === 0 ? (
								<p className="text-center text-muted-foreground py-8">
									No events yet. Run a test to see the agent in action!
								</p>
							) : (
								events.map((event, index) => (
									<div key={`${event.id}-${index}`} className="flex gap-3 p-3 rounded-lg border">
										<div className={`flex-shrink-0 ${getEventColor(event.type)}`}>
											{getEventIcon(event.type)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<Badge variant="outline" className="text-xs">
													{event.type.toUpperCase()}
												</Badge>
												<span className="text-xs text-muted-foreground">
													{new Date(event.timestamp).toLocaleTimeString()}
												</span>
											</div>
											<div className="text-sm">
												{typeof event.content === 'object' 
													? JSON.stringify(event.content, null, 2)
													: event.content
												}
											</div>
											{event.metadata && Object.keys(event.metadata).length > 0 && (
												<details className="mt-2">
													<summary className="text-xs text-muted-foreground cursor-pointer">
														Metadata
													</summary>
													<pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
														{JSON.stringify(event.metadata, null, 2)}
													</pre>
												</details>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>

				{/* Agent Response */}
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Agent Response</CardTitle>
						<CardDescription>Final response and key insights</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{/* Agent Thinking (Real-time Streaming) */}
							{events.filter(e => e.type === 'thinking').length > 0 && (
								<div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
									<h4 className="font-medium mb-2 flex items-center gap-2">
										<Bot className="h-4 w-4" />
										Agent Thinking (Live Stream)
									</h4>
									<div className="space-y-2">
										{/* Show live thinking stream */}
										<div className="font-mono text-sm bg-background p-3 rounded border">
											{events
												.filter(e => e.type === 'thinking')
												.map(e => e.content)
												.join('')
											}
											{/* Show typing indicator if still streaming thinking */}
											{isRunningTest && events.some(e => e.type === 'thinking') && <span className="animate-pulse text-orange-500">▋</span>}
										</div>
										
										{/* Show thinking stats */}
										<div className="text-xs text-muted-foreground">
											Thinking tokens: {events.filter(e => e.type === 'thinking').length} • 
											Live decision-making in progress
										</div>
									</div>
								</div>
							)}

							{/* Final Response (After Decision) */}
							{events.filter(e => e.type === 'chunk' && e.content && !e.content.includes('tool')).length > 0 && (
								<div className="p-4 rounded-lg bg-primary/5 border">
									<h4 className="font-medium mb-2">Final Response:</h4>
									<div className="prose prose-sm space-y-2">
										{/* Show final response */}
										<div className="bg-background p-3 rounded border">
											{events
												.filter(e => e.type === 'chunk' && e.content && !e.content.includes('tool'))
												.map(e => e.content)
												.join(' ')
											}
										</div>
										
										{/* Show response stats */}
										<div className="text-xs text-muted-foreground">
											Response complete
										</div>
									</div>
								</div>
							)}

							{/* Tool Usage Summary */}
							{events.filter(e => e.type === 'tool').length > 0 && (
								<div className="space-y-2">
									<h4 className="font-medium">Tools Used:</h4>
									{events
										.filter(e => e.type === 'tool')
										.map((event, index) => (
											<div key={index} className="p-3 rounded-lg bg-muted text-sm">
												<div className="flex items-center gap-2 mb-1">
													<Calculator className="h-4 w-4" />
													<span className="font-medium">
														{event.metadata?.tool || 'Unknown Tool'}
													</span>
												</div>
												<div>{event.content}</div>
											</div>
										))
									}
								</div>
							)}

						</div>
					</CardContent>
				</Card>
			</div>

			{/* Architecture Info */}
			<Card className="mt-8">
				<CardHeader>
					<CardTitle className="text-lg">V2 Architecture Overview</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
						<div>
							<h4 className="font-medium mb-2">Event Flow</h4>
							<ol className="list-decimal list-inside space-y-1 text-muted-foreground">
								<li>Client → Agent Loop Init</li>
								<li>Agent → Decision Making</li>
								<li>Tool → Execution</li>
								<li>Result → Agent Loop</li>
								<li>Agent → Final Response</li>
							</ol>
						</div>
						<div>
							<h4 className="font-medium mb-2">Technologies</h4>
							<ul className="list-disc list-inside space-y-1 text-muted-foreground">
								<li>Qstash (Event Routing)</li>
								<li>Redis Streams (State)</li>
								<li>Server-Sent Events (SSE)</li>
								<li>streamText (Real-time Decisions)</li>
								<li>Vercel AI SDK (LLM)</li>
							</ul>
						</div>
						<div>
							<h4 className="font-medium mb-2">Benefits</h4>
							<ul className="list-disc list-inside space-y-1 text-muted-foreground">
								<li>Optimized time-to-first-token</li>
								<li>Real-time agent reasoning</li>
								<li>Scalable beyond 6min limits</li>
								<li>Fault-tolerant with retries</li>
								<li>Resumable sessions</li>
								<li>Event-driven architecture</li>
							</ul>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function ConnectionBadge({ status }: { status: string }) {
	const variants: Record<string, { color: string; label: string }> = {
		connecting: { color: "bg-yellow-100 text-yellow-800", label: "Connecting..." },
		connected: { color: "bg-green-100 text-green-800", label: "Connected" },
		disconnected: { color: "bg-gray-100 text-gray-800", label: "Disconnected" },
		error: { color: "bg-red-100 text-red-800", label: "Error" },
	};

	const variant = variants[status] || { color: "bg-gray-100 text-gray-800", label: status };

	return (
		<Badge className={variant.color} variant="secondary">
			{variant.label}
		</Badge>
	);
}