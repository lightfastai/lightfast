import { adaptiveExecutorNetwork } from "./mastra/networks/adaptive-executor";

async function testSandboxPersistence() {
	const threadId = "test-thread-" + Date.now();

	console.log("Testing sandbox persistence with threadId:", threadId);
	console.log("\n=== First call - should create sandbox ===");

	// First call - should create a sandbox
	const result1 = await adaptiveExecutorNetwork.execute({
		id: "adaptive-workflow",
		inputData: {
			task: "Create a file called test.txt with the content 'Hello from sandbox'",
			threadId,
		},
	});

	console.log("\nFirst result:", result1.finalResult);

	console.log("\n=== Second call - should reuse existing sandbox ===");

	// Second call - should reuse the same sandbox
	const result2 = await adaptiveExecutorNetwork.execute({
		id: "adaptive-workflow",
		inputData: {
			task: "List the files in the current directory and show the content of test.txt",
			threadId,
		},
	});

	console.log("\nSecond result:", result2.finalResult);

	console.log("\n=== Third call - verify persistence ===");

	// Third call - verify the sandbox is still the same
	const result3 = await adaptiveExecutorNetwork.execute({
		id: "adaptive-workflow",
		inputData: {
			task: "Check if test.txt still exists and append ' - Still here!' to it",
			threadId,
		},
	});

	console.log("\nThird result:", result3.finalResult);
}

// Run the test
testSandboxPersistence().catch(console.error);
