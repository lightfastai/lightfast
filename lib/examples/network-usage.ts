/**
 * Example: Using the Task Planner Network
 * 
 * This demonstrates how to use the multi-agent network to:
 * 1. Break down a task into steps (Planner Agent)
 * 2. Execute each step (Executor Agent)
 * 3. Synthesize results (Synthesizer Agent)
 */

import { generateTaskPlan, executeStep, synthesizeResults, cleanupExecutorSandbox } from "@/mastra";
import { taskExecutionChannel } from "@/lib/mastra/realtime";
import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function runNetworkExample() {
	const taskDescription = "Create a simple Node.js API that returns the current time in different timezones";
	const chatId = "example-" + Date.now();
	const channel = taskExecutionChannel(chatId);
	
	const sandbox = new SandboxExecutor();

	try {
		// Send initial status
		channel.status({
			status: "starting",
			message: "Starting task planner network example",
		});

		// Step 1: Plan the task
		console.log("📋 Planning task...");
		const taskPlan = await generateTaskPlan(taskDescription);
		console.log("Task broken down into", taskPlan.steps.length, "steps:");
		taskPlan.steps.forEach((step) => {
			console.log(`  ${step.stepNumber}. ${step.title}`);
		});

		// Step 2: Execute each step
		console.log("\n🚀 Executing steps...");
		await sandbox.initialize();
		
		const executionResults = [];
		for (const step of taskPlan.steps) {
			console.log(`\nExecuting step ${step.stepNumber}: ${step.title}`);
			const result = await executeStep(
				{
					stepNumber: step.stepNumber,
					title: step.title,
					description: step.description,
					command: step.command,
					expectedOutput: step.expectedOutput,
					previousResults: executionResults.map((r) => ({
						stepNumber: r.stepNumber,
						output: r.output,
						success: r.success,
					})),
				},
				sandbox,
			);
			
			executionResults.push(result);
			console.log(`  Success: ${result.success}`);
			console.log(`  Insights: ${result.insights}`);
		}

		// Step 3: Synthesize results
		console.log("\n📊 Synthesizing results...");
		const synthesis = await synthesizeResults(taskDescription, taskPlan, executionResults);
		
		console.log("\n=== Final Report ===");
		console.log("Summary:", synthesis.summary);
		console.log("\nKey Results:");
		synthesis.keyResults.forEach((result) => console.log(`  - ${result}`));
		
		if (synthesis.filesCreated.length > 0) {
			console.log("\nFiles Created:");
			synthesis.filesCreated.forEach((file) => console.log(`  - ${file}`));
		}

		if (synthesis.nextSteps && synthesis.nextSteps.length > 0) {
			console.log("\nSuggested Next Steps:");
			synthesis.nextSteps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
		}

		// Send completion
		channel.status({
			status: "completed",
			message: "Example completed successfully",
		});

		// Cleanup
		await sandbox.cleanup();
		await cleanupExecutorSandbox();

		return synthesis;
	} catch (error) {
		console.error("Example failed:", error);
		
		// Cleanup on error
		await sandbox.cleanup();
		await cleanupExecutorSandbox();
		
		throw error;
	}
}

// Run the example if this file is executed directly
if (require.main === module) {
	runNetworkExample()
		.then(() => console.log("\n✅ Example completed!"))
		.catch((error) => console.error("\n❌ Example failed:", error));
}