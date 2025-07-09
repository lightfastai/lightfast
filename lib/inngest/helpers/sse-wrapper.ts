/**
 * Simple SSE wrapper for Inngest steps
 * Ensures every step emits SSE events without complex middleware
 */

interface SSEStepConfig {
	chatId: string;
	functionName?: string;
}

/**
 * Wrap a step.run call to emit SSE events before and after execution
 */
export async function sseStep<T>(step: any, config: SSEStepConfig, stepName: string, fn: () => Promise<T>): Promise<T> {
	const { chatId, functionName } = config;
	const fullStepName = functionName ? `${functionName}/${stepName}` : stepName;

	// Send start event
	await step.sendEvent(`sse-start-${stepName}`, {
		name: "updates/send",
		data: {
			chatId,
			message: `⚙️ ${fullStepName.replace(/-/g, " ")} started...`,
			type: "info",
			metadata: {
				step: stepName,
				function: functionName,
				phase: "start",
				timestamp: new Date().toISOString(),
			},
		},
	});

	try {
		// Execute the actual step
		const result = await step.run(stepName, fn);

		// Send success event
		await step.sendEvent(`sse-success-${stepName}`, {
			name: "updates/send",
			data: {
				chatId,
				message: `✅ ${fullStepName.replace(/-/g, " ")} completed`,
				type: "success",
				metadata: {
					step: stepName,
					function: functionName,
					phase: "complete",
					timestamp: new Date().toISOString(),
				},
			},
		});

		return result;
	} catch (error) {
		// Send error event
		await step.sendEvent(`sse-error-${stepName}`, {
			name: "updates/send",
			data: {
				chatId,
				message: `❌ Error in ${fullStepName.replace(/-/g, " ")}: ${error instanceof Error ? error.message : "Unknown error"}`,
				type: "error",
				metadata: {
					step: stepName,
					function: functionName,
					phase: "error",
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date().toISOString(),
				},
			},
		});

		throw error;
	}
}

/**
 * Wrap a step.sendEvent call to log it via SSE
 */
export async function sseSendEvent(step: any, config: SSEStepConfig, eventName: string, payload: any): Promise<void> {
	const { chatId } = config;

	// Log the event being sent
	await step.sendEvent(`sse-event-${eventName}`, {
		name: "updates/send",
		data: {
			chatId,
			message: `📤 Sending event: ${payload.name}`,
			type: "info",
			metadata: {
				eventName,
				eventType: payload.name,
				timestamp: new Date().toISOString(),
			},
		},
	});

	// Send the actual event
	await step.sendEvent(eventName, payload);
}

/**
 * Wrap a step.sleep call to log it via SSE
 */
export async function sseSleep(step: any, config: SSEStepConfig, sleepName: string, duration: number): Promise<void> {
	const { chatId } = config;

	// Log the sleep
	await step.sendEvent(`sse-sleep-${sleepName}`, {
		name: "updates/send",
		data: {
			chatId,
			message: `⏱️ Waiting ${duration}ms for ${sleepName.replace(/-/g, " ")}...`,
			type: "info",
			metadata: {
				sleep: sleepName,
				duration,
				timestamp: new Date().toISOString(),
			},
		},
	});

	// Perform the actual sleep
	await step.sleep(sleepName, duration);
}

/**
 * Create a wrapped step object that automatically emits SSE events
 */
export function createSSEStep(step: any, config: SSEStepConfig) {
	return {
		run: <T>(name: string, fn: () => Promise<T>) => sseStep(step, config, name, fn),
		sendEvent: (name: string, payload: any) => sseSendEvent(step, config, name, payload),
		sleep: (name: string, duration: number) => sseSleep(step, config, name, duration),

		// Direct access to original step for edge cases
		raw: step,
	};
}

/**
 * Wrapper function for backward compatibility
 */
export function wrapWithSSE(step: any, config: SSEStepConfig) {
	return createSSEStep(step, config);
}
