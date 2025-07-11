import { mastra } from "./mastra";

async function testGeneralSandbox() {
	console.log("Testing general-sandbox-executor network...\n");

	// Test 1: Simple computation task
	console.log("Test 1: Generate a random password");
	try {
		const result1 = await mastra.vnext_networks.generalSandboxExecutorNetwork.run({
			task: "Generate a 16-character secure password",
		});
		console.log("Result:", result1);
		console.log("\n---\n");
	} catch (error) {
		console.error("Test 1 failed:", error);
	}

	// Test 2: Data processing task
	console.log("Test 2: Process CSV data");
	try {
		const result2 = await mastra.vnext_networks.generalSandboxExecutorNetwork.run({
			task: "Create a Python script that generates sample CSV data with 100 rows of user information (name, email, age)",
			context: "The CSV should have realistic looking data and be saved to a file",
		});
		console.log("Result:", result2);
		console.log("\n---\n");
	} catch (error) {
		console.error("Test 2 failed:", error);
	}

	// Test 3: Web development task
	console.log("Test 3: Create a simple web server");
	try {
		const result3 = await mastra.vnext_networks.generalSandboxExecutorNetwork.run({
			task: "Build a simple Express.js API server with a health check endpoint",
		});
		console.log("Result:", result3);
	} catch (error) {
		console.error("Test 3 failed:", error);
	}
}

// Run the test
testGeneralSandbox().catch(console.error);