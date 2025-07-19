import { NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const { id: threadId } = await context.params;

		console.log(`[MEMORY] Request for thread ID: ${threadId}`);

		// Get the V1Agent from Mastra (our default agent for now)
		const agent = mastra.getAgent("V1Agent");
		if (!agent) {
			console.log(`[MEMORY] Agent not found`);
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}

		// Get the agent's memory
		const memory = agent.getMemory();
		if (!memory) {
			console.log(`[MEMORY] Agent memory not configured`);
			return NextResponse.json({ error: "Agent memory not configured" }, { status: 404 });
		}

		// Fetch the thread
		console.log(`[MEMORY] Fetching thread: ${threadId}`);
		const thread = await memory.getThreadById({ threadId });
		console.log(`[MEMORY] Thread found:`, !!thread);

		// If thread doesn't exist yet, return empty working memory
		// This is normal for new conversations that haven't been started yet
		if (!thread) {
			return NextResponse.json({
				threadId,
				workingMemory: { tasks: [], lastUpdated: new Date().toISOString() },
				updatedAt: new Date(),
			});
		}

		// For schema-based working memory, we need to look for the updateWorkingMemory tool calls
		// The agent uses this tool to update the working memory
		const { messages } = await memory.query({
			threadId,
			selectBy: {
				last: 100, // Get more messages to find working memory updates
			},
		});

		// Find the most recent working memory update
		let workingMemory = { tasks: [], lastUpdated: new Date().toISOString() };

		console.log(`[Memory] Processing ${messages.length} messages for thread ${threadId}`);

		// Look for working memory in assistant messages (template-based working memory)
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			const hasToolCalls = "toolCalls" in message && !!(message as any).toolCalls;
			console.log(
				`[Memory] Message ${i}: role=${message.role}, hasContent=${!!message.content}, hasToolCalls=${hasToolCalls}`,
			);
			if (message.content && typeof message.content === "string") {
				console.log(`[Memory] Message ${i} content preview:`, message.content.substring(0, 300) + "...");
			}
			if (message.role === "assistant") {
				// Handle AI SDK v5 format where content is an array of parts
				if (message.content && Array.isArray(message.content)) {
					console.log(`[Memory] Message ${i} has ${message.content.length} content parts`);

					for (const part of message.content) {
						console.log(`[Memory] Part type: ${part.type}, toolName: ${part.toolName || "N/A"}`);

						// Check for tool calls in content parts
						if (part.type === "tool-call" && part.toolName === "updateWorkingMemory" && part.args?.memory) {
							const memoryContent = part.args.memory;
							console.log(
								"Found working memory in tool call part:",
								JSON.stringify(memoryContent).substring(0, 200) + "...",
							);

							// Check if memory is already structured (JSON object with tasks array)
							if (typeof memoryContent === "object" && memoryContent.tasks && Array.isArray(memoryContent.tasks)) {
								console.log("Found structured working memory with", memoryContent.tasks.length, "tasks");
								workingMemory = {
									tasks: memoryContent.tasks,
									lastUpdated: memoryContent.lastUpdated || new Date().toISOString(),
									content: memoryContent.summary || `Structured memory with ${memoryContent.tasks.length} tasks`,
								};
								console.log("Successfully parsed structured working memory");
								break;
							}

							// Otherwise try to parse as markdown (legacy)
							const tasks = parseTasksFromMarkdown(memoryContent);
							workingMemory = {
								tasks,
								lastUpdated: new Date().toISOString(),
								content: memoryContent,
							};
							console.log("Successfully parsed working memory from tool call part with", tasks.length, "tasks");
							break;
						}

						// Check for <working_memory> tags in text parts
						if (part.type === "text" && part.text) {
							const workingMemoryMatch = part.text.match(/<working_memory>([\s\S]*?)<\/working_memory>/);
							if (workingMemoryMatch) {
								const memoryContent = workingMemoryMatch[1].trim();
								console.log("Found working memory content in text part:", memoryContent.substring(0, 200) + "...");

								// Parse the markdown content into a tasks array
								const tasks = parseTasksFromMarkdown(memoryContent);
								workingMemory = {
									tasks,
									lastUpdated: new Date().toISOString(),
									content: memoryContent,
								};
								console.log("Successfully parsed working memory from text part with", tasks.length, "tasks");
								break;
							}
						}
					}

					if (workingMemory.tasks.length > 0) break;
				}

				// Handle legacy format where content is a string
				if (message.content && typeof message.content === "string") {
					try {
						const workingMemoryMatch = message.content.match(/<working_memory>([\s\S]*?)<\/working_memory>/);
						if (workingMemoryMatch) {
							const memoryContent = workingMemoryMatch[1].trim();
							console.log("Found working memory content in message content:", memoryContent.substring(0, 200) + "...");

							// Parse the markdown content into a tasks array
							const tasks = parseTasksFromMarkdown(memoryContent);
							workingMemory = {
								tasks,
								lastUpdated: new Date().toISOString(),
								content: memoryContent,
							};
							console.log("Successfully parsed working memory with", tasks.length, "tasks");
							break;
						}
					} catch (error) {
						console.log(`[MEMORY] Error parsing message content:`, error);
						console.log(`[MEMORY] Message content type:`, typeof message.content);
						console.log(`[MEMORY] Message content:`, message.content);
					}
				}

				// Also check for updateWorkingMemory tool calls in the legacy toolCalls property
				if ("toolCalls" in message && (message as any).toolCalls) {
					for (const toolCall of (message as any).toolCalls) {
						if (toolCall.toolName === "updateWorkingMemory" && toolCall.args?.memory) {
							const memoryContent = toolCall.args.memory;
							console.log(
								"Found working memory in updateWorkingMemory tool call:",
								JSON.stringify(memoryContent).substring(0, 200) + "...",
							);

							// Check if memory is already structured (JSON object with tasks array)
							if (typeof memoryContent === "object" && memoryContent.tasks && Array.isArray(memoryContent.tasks)) {
								console.log("Found structured working memory in toolCalls with", memoryContent.tasks.length, "tasks");
								workingMemory = {
									tasks: memoryContent.tasks,
									lastUpdated: memoryContent.lastUpdated || new Date().toISOString(),
									content: memoryContent.summary || `Structured memory with ${memoryContent.tasks.length} tasks`,
								};
								console.log("Successfully parsed structured working memory from toolCalls");
								break;
							}

							// Otherwise try to parse as markdown (legacy)
							const tasks = parseTasksFromMarkdown(memoryContent);
							workingMemory = {
								tasks,
								lastUpdated: new Date().toISOString(),
								content: memoryContent,
							};
							console.log("Successfully parsed working memory from tool call with", tasks.length, "tasks");
							break;
						}
					}
					if (workingMemory.tasks.length > 0) break;
				}
			}
		}

		// If no working memory found, check for taskManagement tool results
		if (workingMemory.tasks.length === 0) {
			console.log("[Memory] No working memory found, checking for taskManagement tool results...");
			for (let i = messages.length - 1; i >= 0; i--) {
				const message = messages[i];

				// Check for tool results in tool role messages
				if (message.role === "tool" && message.content && Array.isArray(message.content)) {
					for (const part of message.content) {
						if (part.type === "tool-result" && part.toolName === "taskManagement" && part.result?.currentTasks) {
							console.log("[Memory] Found taskManagement result with", part.result.currentTasks.length, "tasks");
							const tasks = part.result.currentTasks.map((task: any) => ({
								id: task.id,
								description: task.description,
								status: task.status,
								priority: task.priority,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
								notes: task.notes,
							}));
							workingMemory = {
								tasks,
								lastUpdated: new Date().toISOString(),
								content: `Found ${tasks.length} tasks from taskManagement tool`,
							};
							console.log("[Memory] Successfully parsed tasks from taskManagement tool result");
							break;
						}
					}
					if (workingMemory.tasks.length > 0) break;
				}

				// Also check for taskManagement in assistant messages with content parts
				if (message.role === "assistant" && message.content && Array.isArray(message.content)) {
					console.log(`[Memory] Checking assistant message ${i} for taskManagement tool calls`);
					for (const part of message.content) {
						// Check for tool result outputs in text parts
						if (part.type === "text" && part.text) {
							// Look for taskManagement output pattern
							if (part.text.includes('"currentTasks"') && part.text.includes('"success": true')) {
								try {
									// Extract JSON from the output
									const jsonMatch = part.text.match(/\{[\s\S]*"currentTasks"[\s\S]*\}/);
									if (jsonMatch) {
										const result = JSON.parse(jsonMatch[0]);
										if (result.currentTasks && Array.isArray(result.currentTasks)) {
											console.log(
												"[Memory] Found taskManagement output in text with",
												result.currentTasks.length,
												"tasks",
											);
											const tasks = result.currentTasks.map((task: any) => ({
												id: task.id,
												description: task.description,
												status: task.status,
												priority: task.priority,
												createdAt: new Date().toISOString(),
												updatedAt: new Date().toISOString(),
												notes: task.notes,
											}));
											workingMemory = {
												tasks,
												lastUpdated: new Date().toISOString(),
												content: `Found ${tasks.length} tasks from taskManagement tool output`,
											};
											console.log("[Memory] Successfully parsed tasks from taskManagement output");
											break;
										}
									}
								} catch (e) {
									console.log("[Memory] Error parsing taskManagement output:", e);
								}
							}
						}
					}
					if (workingMemory.tasks.length > 0) break;
				}
			}
		}

		// Helper function to parse tasks from markdown
		function parseTasksFromMarkdown(content: string) {
			const tasks: any[] = [];
			const lines = content.split("\n");
			let currentStatus = "active";
			const taskIdCounter = 1;

			for (const line of lines) {
				const trimmedLine = line.trim();

				// Detect status sections
				if (trimmedLine.includes("## Active Tasks")) {
					currentStatus = "active";
					continue;
				}
				if (trimmedLine.includes("## In Progress Tasks")) {
					currentStatus = "in_progress";
					continue;
				}
				if (trimmedLine.includes("## Completed Tasks")) {
					currentStatus = "completed";
					continue;
				}

				// Parse task lines (format: - [TASK-ID] Description (Priority: high/medium/low))
				const taskMatch = trimmedLine.match(/^-\s*\[([^\]]+)\]\s*(.+?)(?:\s*\(Priority:\s*(high|medium|low)\))?$/);
				if (taskMatch) {
					const [, id, description, priority = "medium"] = taskMatch;
					tasks.push({
						id,
						description: description.trim(),
						status: currentStatus,
						priority,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					});
				}
			}

			return tasks;
		}

		return NextResponse.json({
			threadId,
			workingMemory,
			updatedAt: thread.updatedAt,
		});
	} catch (error) {
		console.error("Error fetching agent memory:", error);
		return NextResponse.json({ error: "Failed to fetch agent memory" }, { status: 500 });
	}
}
