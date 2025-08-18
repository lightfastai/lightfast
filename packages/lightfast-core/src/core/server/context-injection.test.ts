import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { UIMessage } from "ai";
import { createAgent } from "../primitives/agent";
import { createTool } from "../primitives/tool";
import { InMemoryMemory } from "../memory/adapters/in-memory";
import { streamChat } from "./runtime";
import type { SystemContext, RequestContext } from "./adapters/types";

// Mock the AI SDK's streamText
vi.mock("ai", async () => {
	const actual = await vi.importActual("ai");
	return {
		...actual,
		streamText: vi.fn(),
		convertToModelMessages: vi.fn().mockReturnValue([]),
	};
});

// Define context types
interface CustomRequestContext extends RequestContext {
	userAgent: string;
	ipAddress: string;
	apiKey?: string;
}

interface AgentRuntimeContext {
	sessionId: string;
	resourceId: string;
	customField?: string;
}

describe("Context Injection from Request to Tools", () => {
	let memory: InMemoryMemory;
	let capturedContext: any = null;

	beforeEach(() => {
		memory = new InMemoryMemory();
		capturedContext = null;
		vi.clearAllMocks();
	});

	it("should inject createRequestContext data into tool execution context", async () => {
		// Create a tool that captures the context it receives
		const contextCaptureTool = createTool<AgentRuntimeContext & CustomRequestContext>({
			description: "Captures context for testing",
			inputSchema: z.object({ 
				action: z.string() 
			}),
			execute: async ({ action }, context) => {
				// Capture the full context that the tool receives
				capturedContext = context;
				return { 
					result: `Executed ${action}`,
					sessionId: context.sessionId,
					userAgent: context.userAgent,
				};
			},
		});

		// Create an agent with the context-aware tool
		const agent = createAgent<AgentRuntimeContext>({
			name: "context-test-agent",
			model: {} as any,
			system: "You are a test agent",
			tools: {
				captureTool: contextCaptureTool,
			},
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
				customField: "agent-specific-data",
			}),
		});

		// Mock the streamText to simulate tool execution
		const { streamText } = await import("ai");
		(streamText as any).mockImplementation((params: any) => {
			// Simulate the AI SDK calling our tool
			if (params.tools?.captureTool) {
				// Execute the tool to capture context
				params.tools.captureTool.execute({ action: "test-action" });
			}

			// Return a mock stream result
			return {
				textStream: {
					[Symbol.asyncIterator]: async function* () {
						yield "Test response";
					},
				},
				toUIMessageStreamResponse: () => new Response(),
			};
		});

		// Create contexts
		const systemContext: SystemContext = {
			sessionId: "test-session-123",
			resourceId: "user-456",
		};

		const requestContext: CustomRequestContext = {
			userAgent: "Mozilla/5.0 Test Browser",
			ipAddress: "192.168.1.1",
			apiKey: "test-api-key",
		};

		// Create a test message
		const userMessage: UIMessage = {
			id: "msg-1",
			role: "user",
			content: "Test message",
		};

		// Call streamChat which should merge contexts and pass to tools
		await streamChat({
			agent,
			sessionId: systemContext.sessionId,
			message: userMessage,
			memory,
			resourceId: systemContext.resourceId,
			systemContext,
			requestContext,
		});

		// Verify that the tool received the merged context
		expect(capturedContext).toBeDefined();
		expect(capturedContext).toMatchObject({
			// From systemContext
			sessionId: "test-session-123",
			resourceId: "user-456",
			// From requestContext
			userAgent: "Mozilla/5.0 Test Browser",
			ipAddress: "192.168.1.1",
			apiKey: "test-api-key",
			// From agent's createRuntimeContext
			customField: "agent-specific-data",
		});
	});

	it("should properly merge systemContext, requestContext, and agentContext", async () => {
		// Create a tool that captures all context fields
		const mergeTestTool = createTool<any>({
			description: "Tests context merging",
			inputSchema: z.object({ test: z.string() }),
			execute: async (input, context) => {
				capturedContext = context;
				return { success: true };
			},
		});

		const agent = createAgent({
			name: "merge-test-agent",
			model: {} as any,
			system: "Test system",
			tools: { mergeTestTool },
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,  // This will override systemContext.sessionId
				resourceId,
				agentSpecific: "agent-value",
				// Test override priority
				userAgent: "agent-override", // Should be overridden by agentContext
			}),
		});

		// Mock streamText
		const { streamText } = await import("ai");
		(streamText as any).mockImplementation((params: any) => {
			if (params.tools?.mergeTestTool) {
				params.tools.mergeTestTool.execute({ test: "value" });
			}
			return {
				textStream: { [Symbol.asyncIterator]: async function* () { yield ""; } },
				toUIMessageStreamResponse: () => new Response(),
			};
		});

		const systemContext: SystemContext = {
			sessionId: "system-session",
			resourceId: "system-resource",
		};

		const requestContext = {
			userAgent: "request-user-agent",
			requestId: "req-123",
		};

		await streamChat({
			agent,
			sessionId: "system-session",
			message: { id: "1", role: "user", content: "test" } as UIMessage,
			memory,
			resourceId: "system-resource",
			systemContext,
			requestContext,
		});

		// Verify merge order: system -> request -> agent (later values override earlier)
		expect(capturedContext).toMatchObject({
			// From systemContext (not overridden)
			sessionId: "system-session",
			resourceId: "system-resource",
			// From requestContext (not overridden)
			requestId: "req-123",
			// From agentContext (overrides requestContext)
			userAgent: "agent-override",
			agentSpecific: "agent-value",
		});
	});

	it("should handle dynamic tool resolution with context", async () => {
		let toolCreationContext: any = null;
		let toolExecutionContext: any = null;

		// Create dynamic tools based on context
		const dynamicToolsFactory = (context: any) => {
			toolCreationContext = context;
			
			const dynamicTool = createTool<any>({
				description: `Tool for session ${context.sessionId}`,
				inputSchema: z.object({ input: z.string() }),
				execute: async ({ input }, ctx) => {
					toolExecutionContext = ctx;
					return { 
						result: input,
						sessionFromCreation: toolCreationContext.sessionId,
						sessionFromExecution: ctx.sessionId,
					};
				},
			});

			return {
				dynamicTool: dynamicTool(context),
			};
		};

		const agent = createAgent({
			name: "dynamic-agent",
			model: {} as any,
			system: "Dynamic test",
			tools: dynamicToolsFactory,
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
				timestamp: Date.now(),
			}),
		});

		// Mock streamText
		const { streamText } = await import("ai");
		(streamText as any).mockImplementation((params: any) => {
			if (params.tools?.dynamicTool) {
				params.tools.dynamicTool.execute({ input: "test" });
			}
			return {
				textStream: { [Symbol.asyncIterator]: async function* () { yield ""; } },
				toUIMessageStreamResponse: () => new Response(),
			};
		});

		await streamChat({
			agent,
			sessionId: "dynamic-session",
			message: { id: "1", role: "user", content: "test" } as UIMessage,
			memory,
			resourceId: "dynamic-resource",
			systemContext: {
				sessionId: "dynamic-session",
				resourceId: "dynamic-resource",
			},
			requestContext: {
				requestId: "dynamic-request",
			},
		});

		// Both contexts should have the same merged data
		expect(toolCreationContext).toBeDefined();
		expect(toolExecutionContext).toBeDefined();
		expect(toolCreationContext).toEqual(toolExecutionContext);
		expect(toolCreationContext.sessionId).toBe("dynamic-session");
		expect(toolCreationContext.requestId).toBe("dynamic-request");
	});

	it("should handle tool factories with missing optional contexts", async () => {
		const toolWithOptionalContext = createTool({
			description: "Tool without required context",
			inputSchema: z.object({ value: z.string() }),
			execute: async ({ value }, context) => {
				capturedContext = context;
				return { processed: value.toUpperCase() };
			},
		});

		const agent = createAgent({
			name: "no-context-agent",
			model: {} as any,
			system: "Test",
			tools: {
				testTool: toolWithOptionalContext,
			},
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
			}),
		});

		const { streamText } = await import("ai");
		(streamText as any).mockImplementation((params: any) => {
			if (params.tools?.testTool) {
				params.tools.testTool.execute({ value: "test" });
			}
			return {
				textStream: { [Symbol.asyncIterator]: async function* () { yield ""; } },
				toUIMessageStreamResponse: () => new Response(),
			};
		});

		await streamChat({
			agent,
			sessionId: "session",
			message: { id: "1", role: "user", content: "test" } as UIMessage,
			memory,
			resourceId: "resource",
			systemContext: { sessionId: "session", resourceId: "resource" },
			// No requestContext provided
		});

		// Should still have systemContext at minimum
		expect(capturedContext).toMatchObject({
			sessionId: "session",
			resourceId: "resource",
		});
	});

	it("should pass context through nested tool execution", async () => {
		const contexts: any[] = [];

		// Create multiple tools that work together
		const firstTool = createTool<any>({
			description: "First tool in chain",
			inputSchema: z.object({ input: z.string() }),
			execute: async ({ input }, context) => {
				contexts.push({ tool: "first", context });
				return { next: `processed-${input}` };
			},
		});

		const secondTool = createTool<any>({
			description: "Second tool in chain",
			inputSchema: z.object({ data: z.string() }),
			execute: async ({ data }, context) => {
				contexts.push({ tool: "second", context });
				return { final: data.toUpperCase() };
			},
		});

		const agent = createAgent({
			name: "chain-agent",
			model: {} as any,
			system: "Chain test",
			tools: {
				firstTool,
				secondTool,
			},
			createRuntimeContext: ({ sessionId, resourceId }) => ({
				sessionId,
				resourceId,
				chainId: "chain-123",
			}),
		});

		const { streamText } = await import("ai");
		(streamText as any).mockImplementation((params: any) => {
			// Simulate calling both tools
			if (params.tools) {
				if (params.tools.firstTool) {
					params.tools.firstTool.execute({ input: "start" });
				}
				if (params.tools.secondTool) {
					params.tools.secondTool.execute({ data: "middle" });
				}
			}
			return {
				textStream: { [Symbol.asyncIterator]: async function* () { yield ""; } },
				toUIMessageStreamResponse: () => new Response(),
			};
		});

		await streamChat({
			agent,
			sessionId: "chain-session",
			message: { id: "1", role: "user", content: "test" } as UIMessage,
			memory,
			resourceId: "chain-resource",
			systemContext: { sessionId: "chain-session", resourceId: "chain-resource" },
			requestContext: { traceId: "trace-456" },
		});

		// Both tools should receive the same context
		expect(contexts).toHaveLength(2);
		expect(contexts[0].context).toEqual(contexts[1].context);
		expect(contexts[0].context).toMatchObject({
			sessionId: "chain-session",
			resourceId: "chain-resource",
			traceId: "trace-456",
			chainId: "chain-123",
		});
	});
});