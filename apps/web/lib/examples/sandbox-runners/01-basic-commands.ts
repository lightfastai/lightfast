/**
 * Example 01: Basic Command Execution
 * Demonstrates fundamental command execution patterns
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function basicCommandExamples() {
	const executor = new SandboxExecutor();

	console.log("🚀 Basic Command Examples\n");

	// Example 1: Simple echo command
	console.log("1. Echo command:");
	const echoResult = await executor.runCommand("echo", ["Hello from Vercel Sandbox!"]);
	console.log("   Output:", echoResult.stdout);
	console.log("   Success:", echoResult.success);

	// Example 2: Get system information
	console.log("\n2. System information:");
	const unameResult = await executor.runCommand("uname", ["-a"]);
	console.log("   System:", unameResult.stdout);

	// Example 3: Working with environment variables
	console.log("\n3. Environment variables:");
	const envResult = await executor.runCommand("echo", ["$HOME", "$USER"], {
		env: { CUSTOM_VAR: "Hello World" },
	});
	console.log("   Output:", envResult.stdout);

	// Example 4: Running commands in specific directory
	console.log("\n4. Directory-specific commands:");
	await executor.createDirectory("/home/vercel-sandbox/test-dir");
	const pwdResult = await executor.runCommand("pwd", [], {
		cwd: "/home/vercel-sandbox/test-dir",
	});
	console.log("   Working directory:", pwdResult.stdout.trim());

	// Example 5: Command chaining with shell
	console.log("\n5. Shell command chaining:");
	const chainResult = await executor.executeScript(
		"echo 'First command' && echo 'Second command' && echo 'Third command'",
	);
	console.log("   Output:", chainResult.stdout);

	// Example 6: Error handling
	console.log("\n6. Error handling:");
	const errorResult = await executor.runCommand("ls", ["/non-existent-directory"]);
	console.log("   Success:", errorResult.success);
	console.log("   Exit code:", errorResult.exitCode);
	console.log("   Error:", errorResult.stderr);

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	basicCommandExamples().catch(console.error);
}
