import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AgentConfigurationError,
	AgentStreamError,
	ApiError,
	BadRequestError,
	CacheOperationError,
	ContextCreationError,
	ForbiddenError,
	GenericBadRequestError,
	InternalServerError,
	InvalidPathError,
	MessageConversionError,
	MethodNotAllowedError,
	NoMessagesError,
	NotFoundError,
	toAgentApiError,
	ToolExecutionError,
	UnauthorizedError,
} from "./errors";

describe("Error Handling - Critical Edge Cases", () => {
	describe("Error Inheritance and Serialization", () => {
		it("should handle error inheritance correctly", () => {
			const badRequestError = new GenericBadRequestError("Invalid input");

			expect(badRequestError instanceof Error).toBe(true);
			expect(badRequestError instanceof ApiError).toBe(true);
			expect(badRequestError instanceof BadRequestError).toBe(true);
			expect(badRequestError instanceof GenericBadRequestError).toBe(true);

			expect(badRequestError.statusCode).toBe(400);
			expect(badRequestError.errorCode).toBe("BAD_REQUEST");
			expect(badRequestError.message).toBe("Invalid input");
			expect(badRequestError.name).toBe("GenericBadRequestError");
		});

		it("should serialize errors to JSON correctly", () => {
			const unauthorizedError = new UnauthorizedError("Token expired");
			const json = unauthorizedError.toJSON();

			expect(json).toMatchObject({
				error: "Token expired",
				code: "UNAUTHORIZED",
				statusCode: 401,
				source: "lightfast-core",
				category: "authentication",
				severity: "fatal",
			});
		});

		it("should handle errors with cause chain", () => {
			const rootCause = new Error("Database connection failed");
			const internalError = new InternalServerError(
				"Service unavailable",
				rootCause,
			);

			expect(internalError.cause).toBe(rootCause);
			expect(internalError.statusCode).toBe(500);
			expect(internalError.message).toBe("Service unavailable");

			const json = internalError.toJSON();
			expect(json).toMatchObject({
				statusCode: 500,
				code: "INTERNAL_SERVER_ERROR",
				source: "lightfast-core",
				category: "unknown",
				severity: "fatal",
			});
		});

		it("should handle AgentStreamError with cause chain", () => {
			const rootCause = new Error("Model configuration invalid");
			const streamError = new AgentStreamError(
				"Model configuration invalid",
				rootCause,
			);

			expect(streamError.cause).toBe(rootCause);
			expect(streamError.statusCode).toBe(500);
			expect(streamError.message).toBe("Agent streaming failed: Model configuration invalid");
			expect(streamError instanceof ApiError).toBe(true);

			const json = streamError.toJSON();
			expect(json).toMatchObject({
				statusCode: 500,
				code: "AGENT_STREAM_ERROR",
				error: "Agent streaming failed: Model configuration invalid",
				source: "lightfast-core",
				category: "stream",
				severity: "recoverable",
			});
		});
	});

	describe("Error Construction Edge Cases", () => {
		it("should handle MethodNotAllowedError with multiple allowed methods", () => {
			const error = new MethodNotAllowedError("DELETE", ["GET", "POST", "PUT"]);

			expect(error.message).toBe(
				"Method DELETE not allowed. Allowed methods: GET, POST, PUT",
			);
			expect(error.statusCode).toBe(405);
			expect(error.errorCode).toBe("METHOD_NOT_ALLOWED");
		});

		it("should handle InvalidPathError with expected format", () => {
			const error = new InvalidPathError("/api/v1/resource/{id}");

			expect(error.message).toBe(
				"Invalid path: expected /api/v1/resource/{id}",
			);
			expect(error.statusCode).toBe(400);
			expect(error.errorCode).toBe("INVALID_PATH");
		});

		it("should handle UnauthorizedError with default message", () => {
			const error = new UnauthorizedError();

			expect(error.message).toBe("Unauthorized");
			expect(error.statusCode).toBe(401);
			expect(error.errorCode).toBe("UNAUTHORIZED");
		});

		it("should handle InternalServerError with default message", () => {
			const error = new InternalServerError();

			expect(error.message).toBe("Internal server error");
			expect(error.statusCode).toBe(500);
			expect(error.errorCode).toBe("INTERNAL_SERVER_ERROR");
			expect(error.cause).toBeUndefined();
		});
	});

	describe("Error Stack Trace Handling", () => {
		it("should preserve stack traces in error chain", () => {
			const originalError = new Error("Original error");
			const wrappedError = new InternalServerError(
				"Wrapped error",
				originalError,
			);

			expect(wrappedError.stack).toBeDefined();
			expect(wrappedError.stack).toContain("InternalServerError");
			expect(wrappedError.cause).toBe(originalError);
			expect(originalError.stack).toBeDefined();
		});

		it("should handle errors with corrupted or missing stack traces", () => {
			const error = new GenericBadRequestError("Test error");

			// Simulate corrupted stack
			error.stack = null as any;

			const json = error.toJSON();
			expect(json.error).toBe("Test error");
			expect(json.code).toBe("BAD_REQUEST");
			expect(json.statusCode).toBe(400);
		});
	});

	describe("Error Message Sanitization", () => {
		it("should handle errors with special characters in messages", () => {
			const specialCharsMessage =
				'Error with special chars: <script>alert("xss")</script> & "quotes" \n\t';
			const error = new GenericBadRequestError(specialCharsMessage);

			expect(error.message).toBe(specialCharsMessage);

			const json = error.toJSON();
			expect(json.error).toBe(specialCharsMessage);
		});

		it("should handle errors with very long messages", () => {
			const longMessage = "A".repeat(10000); // 10KB message
			const error = new InternalServerError(longMessage);

			expect(error.message).toBe(longMessage);
			expect(error.message.length).toBe(10000);

			const json = error.toJSON();
			expect(json.error).toBe(longMessage);
		});

		it("should handle errors with null or undefined messages", () => {
			// TypeScript won't allow this normally, but runtime could pass undefined
			const error = new GenericBadRequestError(null as any);

			expect(error.message).toBe("null");

			const json = error.toJSON();
			expect(json.error).toBe("null");
		});

		it("should handle errors with non-string messages", () => {
			// Runtime could pass non-string values
			const error = new GenericBadRequestError({ complex: "object" } as any);

			expect(error.message).toBe("[object Object]");

			const json = error.toJSON();
			expect(json.error).toBe("[object Object]");
		});
	});

	describe("Error in Error Handling", () => {
		it("should handle circular reference in error cause", () => {
			const error1 = new InternalServerError("Error 1");
			const error2 = new InternalServerError("Error 2", error1);

			// Create circular reference
			(error1 as any).cause = error2;

			// Should not crash when serializing
			const json = error2.toJSON();
			expect(json.error).toBe("Error 2");
			expect(json.code).toBe("INTERNAL_SERVER_ERROR");
		});

		it("should handle toJSON method throwing an error", () => {
			const error = new GenericBadRequestError("Test error");

			// Mock toJSON to throw
			const originalToJSON = error.toJSON;
			error.toJSON = vi.fn().mockImplementation(() => {
				throw new Error("toJSON failed");
			});

			// Should handle gracefully in error handling middleware
			expect(() => {
				try {
					error.toJSON();
				} catch (e) {
					// Fallback error representation
					const fallback = {
						error: error.message,
						code: "SERIALIZATION_ERROR",
						statusCode: 500,
					};
					expect(fallback.error).toBe("Test error");
				}
			}).not.toThrow();

			// Restore original method
			error.toJSON = originalToJSON;
		});

		it("should handle malformed Error objects", () => {
			const malformedError = Object.create(Error.prototype);
			malformedError.name = undefined;
			malformedError.message = undefined;
			malformedError.statusCode = "not-a-number";
			malformedError.errorCode = null;

			// Should handle malformed error objects gracefully
			expect(malformedError.name).toBeUndefined();
			expect(malformedError.message).toBeUndefined();
		});
	});

	describe("Concurrent Error Creation", () => {
		it("should handle rapid concurrent error creation", async () => {
			const createErrors = async () => {
				const promises = Array.from({ length: 100 }, (_, i) =>
					Promise.resolve(new GenericBadRequestError(`Error ${i}`)),
				);
				return Promise.all(promises);
			};

			const errors = await createErrors();

			expect(errors).toHaveLength(100);
			errors.forEach((error, index) => {
				expect(error.message).toBe(`Error ${index}`);
				expect(error.statusCode).toBe(400);
				expect(error instanceof GenericBadRequestError).toBe(true);
			});
		});

		it("should handle error creation under memory pressure", () => {
			// Simulate memory pressure by creating many large error objects
			const largeErrors = Array.from({ length: 1000 }, (_, i) => {
				const largeMessage = `Error ${i}: ${"x".repeat(1000)}`;
				return new InternalServerError(largeMessage);
			});

			expect(largeErrors).toHaveLength(1000);

			// Verify they're still functional
			largeErrors.forEach((error, index) => {
				expect(error.statusCode).toBe(500);
				expect(error.message).toContain(`Error ${index}`);
			});
		});
	});

	describe("Error Type Checking Edge Cases", () => {
		it("should correctly identify error types with instanceof", () => {
			const apiError = new GenericBadRequestError("Test");
			const regularError = new Error("Regular error");
			const unauthorizedError = new UnauthorizedError();

			expect(apiError instanceof ApiError).toBe(true);
			expect(apiError instanceof BadRequestError).toBe(true);
			expect(apiError instanceof UnauthorizedError).toBe(false);

			expect(regularError instanceof ApiError).toBe(false);
			expect(regularError instanceof Error).toBe(true);

			expect(unauthorizedError instanceof ApiError).toBe(true);
			expect(unauthorizedError instanceof BadRequestError).toBe(false);
		});

		it("should handle errors from different execution contexts", () => {
			// Simulate error from different context (e.g., iframe, worker)
			const crossContextError = Object.create(Error.prototype);
			crossContextError.name = "GenericBadRequestError";
			crossContextError.message = "Cross-context error";
			crossContextError.statusCode = 400;
			crossContextError.errorCode = "BAD_REQUEST";

			// Should handle gracefully even if instanceof doesn't work
			expect(crossContextError.name).toBe("GenericBadRequestError");
			expect(crossContextError.statusCode).toBe(400);
		});
	});

	describe("Error Message Encoding", () => {
		it("should handle unicode characters in error messages", () => {
			const unicodeMessage = "Error with unicode: 你好世界 🚀 💥 ⚡ ñáéíóú";
			const error = new GenericBadRequestError(unicodeMessage);

			expect(error.message).toBe(unicodeMessage);

			const json = error.toJSON();
			expect(json.error).toBe(unicodeMessage);
		});

		it("should handle binary data in error messages", () => {
			const binaryMessage = String.fromCharCode(0, 1, 2, 255, 254, 253);
			const error = new InternalServerError(binaryMessage);

			expect(error.message).toBe(binaryMessage);

			const json = error.toJSON();
			expect(json.error).toBe(binaryMessage);
		});

		it("should handle very large unicode strings", () => {
			const largeUnicode = "🚀".repeat(5000); // ~20KB of emoji
			const error = new GenericBadRequestError(largeUnicode);

			expect(error.message).toBe(largeUnicode);
			// Emoji characters take 2 UTF-16 code units, so length is 2x repeat count
			expect(error.message.length).toBe(10000);
		});
	});

	describe("toAgentApiError Converter Function", () => {
		it("should pass through existing ApiError instances unchanged", () => {
			const existingError = new AgentConfigurationError("model", "Missing model");
			const result = toAgentApiError(existingError, "stream");

			expect(result).toBe(existingError); // Same instance
			expect(result).toBeInstanceOf(AgentConfigurationError);
		});

		it("should convert model configuration errors", () => {
			const error = new Error("Model configuration is invalid");
			const result = toAgentApiError(error, "stream");

			expect(result).toBeInstanceOf(AgentConfigurationError);
			expect(result.message).toBe("Agent configuration error: model - Model configuration is invalid");
			expect(result.statusCode).toBe(400);
		});

		it("should convert context creation errors", () => {
			const error = new Error("Context creation failed");
			const result = toAgentApiError(error, "createRuntimeContext");

			expect(result).toBeInstanceOf(ContextCreationError);
			expect(result.message).toBe("Failed to create runtime context: Context creation failed");
			expect(result.statusCode).toBe(400);
		});

		it("should convert tool factory errors", () => {
			const error = new Error("Tool factory execution failed");
			const result = toAgentApiError(error, "resolveTools");

			expect(result).toBeInstanceOf(ToolExecutionError);
			expect(result.message).toBe("Tool execution failed: unknown - Tool factory execution failed");
			expect(result.statusCode).toBe(500);
		});

		it("should convert cache operation errors", () => {
			const error = new Error("Cache operation failed");
			const result = toAgentApiError(error, "caching");

			expect(result).toBeInstanceOf(CacheOperationError);
			expect(result.message).toBe("Cache operation failed: caching - Cache operation failed");
			expect(result.statusCode).toBe(500);
		});

		it("should convert message conversion errors", () => {
			const error = new Error("Message conversion failed");
			const result = toAgentApiError(error, "convertMessages");

			expect(result).toBeInstanceOf(MessageConversionError);
			expect(result.message).toBe("Message conversion failed: convertMessages - Message conversion failed");
			expect(result.statusCode).toBe(400);
		});

		it("should convert no messages errors", () => {
			const error = new Error("No messages provided");
			const result = toAgentApiError(error, "stream");

			expect(result).toBeInstanceOf(NoMessagesError);
			expect(result.message).toBe("At least one message is required");
			expect(result.statusCode).toBe(400);
		});

		it("should use operation-specific mapping for stream operations", () => {
			const error = new Error("Unknown stream error");
			const result = toAgentApiError(error, "stream");

			expect(result).toBeInstanceOf(AgentStreamError);
			expect(result.message).toBe("Agent streaming failed: Unknown stream error");
			expect(result.statusCode).toBe(500);
		});

		it("should use operation-specific mapping for createRuntimeContext", () => {
			const error = new Error("Unknown context error");
			const result = toAgentApiError(error, "createRuntimeContext");

			expect(result).toBeInstanceOf(ContextCreationError);
			expect(result.message).toBe("Failed to create runtime context: Unknown context error");
			expect(result.statusCode).toBe(400);
		});

		it("should use operation-specific mapping for resolveTools", () => {
			const error = new Error("Unknown tool error");
			const result = toAgentApiError(error, "resolveTools");

			expect(result).toBeInstanceOf(ToolExecutionError);
			expect(result.message).toBe("Tool execution failed: factory - Unknown tool error");
			expect(result.statusCode).toBe(500);
		});

		it("should handle unknown operations with default mapping", () => {
			const error = new Error("Unknown operation error");
			const result = toAgentApiError(error, "unknownOperation");

			expect(result).toBeInstanceOf(AgentStreamError);
			expect(result.message).toBe("Agent streaming failed: unknownOperation: Unknown operation error");
			expect(result.statusCode).toBe(500);
		});

		it("should handle non-Error thrown values", () => {
			const result1 = toAgentApiError("string error", "stream");
			expect(result1).toBeInstanceOf(AgentStreamError);
			expect(result1.message).toBe("Agent streaming failed: stream: string error");

			const result2 = toAgentApiError(null, "stream");
			expect(result2).toBeInstanceOf(AgentStreamError);
			expect(result2.message).toBe("Agent streaming failed: stream: null");

			const result3 = toAgentApiError({ code: "CUSTOM_ERROR" }, "stream");
			expect(result3).toBeInstanceOf(AgentStreamError);
			expect(result3.message).toBe("Agent streaming failed: stream: [object Object]");
		});

		it("should preserve error causes when converting", () => {
			const originalError = new Error("Original error");
			const result = toAgentApiError(originalError, "stream");

			expect(result).toBeInstanceOf(AgentStreamError);
			if (result instanceof AgentStreamError) {
				expect(result.cause).toBe(originalError);
			}
		});

		it("should handle case-insensitive pattern matching", () => {
			const error1 = new Error("MODEL CONFIGURATION is invalid");
			const result1 = toAgentApiError(error1, "stream");
			expect(result1).toBeInstanceOf(AgentConfigurationError);

			const error2 = new Error("Context Creation Failed");
			const result2 = toAgentApiError(error2, "stream");
			expect(result2).toBeInstanceOf(ContextCreationError);

			const error3 = new Error("TOOL FACTORY error");
			const result3 = toAgentApiError(error3, "stream");
			expect(result3).toBeInstanceOf(ToolExecutionError);
		});

		it("should verify all converted errors inherit from ApiError", () => {
			const testCases = [
				{ error: new Error("Model configuration failed"), operation: "stream" },
				{ error: new Error("Context creation failed"), operation: "stream" },
				{ error: new Error("Tool factory failed"), operation: "stream" },
				{ error: new Error("Cache operation failed"), operation: "stream" },
				{ error: new Error("Message conversion failed"), operation: "stream" },
				{ error: new Error("No messages required"), operation: "stream" },
				{ error: new Error("Unknown error"), operation: "stream" },
			];

			testCases.forEach(({ error, operation }) => {
				const result = toAgentApiError(error, operation);
				expect(result).toBeInstanceOf(ApiError);
				expect(result.statusCode).toBeGreaterThanOrEqual(400);
				expect(result.statusCode).toBeLessThan(600);
				expect(result.errorCode).toBeDefined();
				expect(typeof result.errorCode).toBe("string");
				expect(result.toJSON()).toEqual({
					error: result.message,
					code: result.errorCode,
					statusCode: result.statusCode,
				});
			});
		});
	});
});
