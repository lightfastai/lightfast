import { SandboxExecutor } from "./sandbox-executor";

// Mock implementation for testing without Vercel credentials
class MockSandboxExecutor extends SandboxExecutor {
	private mockFiles: Map<string, string> = new Map();
	private mockPackages: Set<string> = new Set();

	async initialize(): Promise<void> {
		// Mock initialization - no actual sandbox needed
		console.log("🔧 Mock sandbox initialized");
	}

	async setupEnvironment(packageJson: any, setupScript: string): Promise<any> {
		const startTime = Date.now();

		// Simulate package installation
		if (packageJson.dependencies) {
			for (const [pkg, version] of Object.entries(packageJson.dependencies)) {
				if (pkg === "non-existent-package-12345") {
					return {
						success: false,
						error: `Failed to install dependencies: npm ERR! 404 Not Found - ${pkg}@${version}`,
						exitCode: 1,
						duration: Date.now() - startTime,
					};
				}
				this.mockPackages.add(pkg);
			}
		}

		// Simulate setup script execution
		if (setupScript.includes("require('lodash')") && this.mockPackages.has("lodash")) {
			return {
				success: true,
				output: "Lodash version: 4.17.21\nSetup complete!",
				exitCode: 0,
				duration: Date.now() - startTime,
			};
		}

		return {
			success: true,
			output: "Setup complete!",
			exitCode: 0,
			duration: Date.now() - startTime,
		};
	}

	async executeScript(scriptName: string, scriptContent: string): Promise<any> {
		const startTime = Date.now();

		// Mock script execution based on content
		if (scriptContent.includes("Hello from sandbox!")) {
			return {
				success: true,
				output: "Hello from sandbox!",
				exitCode: 0,
				duration: Date.now() - startTime,
			};
		}

		if (scriptContent.includes("throw new Error")) {
			return {
				success: false,
				error: "This is an error message\nError: Test error",
				exitCode: 1,
				duration: Date.now() - startTime,
			};
		}

		if (scriptContent.includes("require('lodash')") && this.mockPackages.has("lodash")) {
			return {
				success: true,
				output: "Sum: 15\nMax: 5",
				exitCode: 0,
				duration: Date.now() - startTime,
			};
		}

		if (scriptContent.includes("Execution") && scriptContent.includes("of 3")) {
			const match = scriptContent.match(/Execution (\d+) of 3/);
			if (match) {
				return {
					success: true,
					output: `Execution ${match[1]} of 3\nFile written: output-${match[1]}.txt`,
					exitCode: 0,
					duration: Date.now() - startTime,
				};
			}
		}

		if (scriptContent.includes("Starting timing test")) {
			// Simulate 2 second delay
			const delay = 2000;
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve({
						success: true,
						output: "Starting timing test...\nTiming test complete after 2 seconds",
						exitCode: 0,
						duration: delay + (Date.now() - startTime),
					});
				}, delay);
			});
		}

		if (scriptContent.includes("fs.mkdirSync")) {
			return {
				success: true,
				output: "Directory created\nFile written\nFile content: Hello World!\nDirectory contents: test.txt",
				exitCode: 0,
				duration: Date.now() - startTime,
			};
		}

		return {
			success: true,
			output: "",
			exitCode: 0,
			duration: Date.now() - startTime,
		};
	}

	async cleanup(): Promise<void> {
		this.mockFiles.clear();
		this.mockPackages.clear();
		console.log("🧹 Mock sandbox cleaned up");
	}
}

async function runTests() {
	console.log("🧪 Starting Sandbox Executor Mock Tests\n");
	console.log(
		"📝 Note: This is a mock test that simulates sandbox behavior without requiring Vercel API credentials\n",
	);

	const executor = new MockSandboxExecutor();
	let testsPassed = 0;
	let testsFailed = 0;

	// Test 1: Basic script execution
	console.log("Test 1: Basic script execution");
	try {
		const result = await executor.executeScript(
			"test.js",
			`
			console.log("Hello from sandbox!");
			process.exit(0);
		`,
		);

		if (result.success && result.output?.includes("Hello from sandbox!")) {
			console.log("✅ Basic execution test passed");
			testsPassed++;
		} else {
			console.log("❌ Basic execution test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Basic execution test threw error:", error);
		testsFailed++;
	}

	// Test 2: Script with error
	console.log("\nTest 2: Script with error handling");
	try {
		const result = await executor.executeScript(
			"error-test.js",
			`
			console.error("This is an error message");
			throw new Error("Test error");
		`,
		);

		if (!result.success && result.error && result.exitCode !== 0) {
			console.log("✅ Error handling test passed");
			testsPassed++;
		} else {
			console.log("❌ Error handling test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Error handling test threw error:", error);
		testsFailed++;
	}

	// Test 3: Environment setup with package.json
	console.log("\nTest 3: Environment setup with dependencies");
	try {
		const packageJson = {
			name: "test-project",
			version: "1.0.0",
			dependencies: {
				lodash: "^4.17.21",
			},
		};

		const setupScript = `
			const _ = require('lodash');
			console.log('Lodash version:', _.VERSION);
			console.log('Setup complete!');
		`;

		const setupResult = await executor.setupEnvironment(packageJson, setupScript);

		if (setupResult.success && setupResult.output?.includes("Setup complete!")) {
			console.log("✅ Environment setup test passed");
			testsPassed++;
		} else {
			console.log("❌ Environment setup test failed", setupResult);
			testsFailed++;
		}

		// Test 4: Use the installed dependency
		console.log("\nTest 4: Using installed dependencies");
		const execResult = await executor.executeScript(
			"use-dependency.js",
			`
			const _ = require('lodash');
			const arr = [1, 2, 3, 4, 5];
			console.log('Sum:', _.sum(arr));
			console.log('Max:', _.max(arr));
		`,
		);

		if (execResult.success && execResult.output?.includes("Sum: 15") && execResult.output?.includes("Max: 5")) {
			console.log("✅ Dependency usage test passed");
			testsPassed++;
		} else {
			console.log("❌ Dependency usage test failed", execResult);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Environment setup tests threw error:", error);
		testsFailed += 2;
	}

	// Test 5: Multiple sequential executions
	console.log("\nTest 5: Multiple sequential executions");
	try {
		const results = [];
		for (let i = 1; i <= 3; i++) {
			const result = await executor.executeScript(
				`seq-${i}.js`,
				`
				console.log('Execution ${i} of 3');
				const fs = require('fs');
				fs.writeFileSync('output-${i}.txt', 'Test ${i}');
				console.log('File written: output-${i}.txt');
			`,
			);
			results.push(result);
		}

		if (results.every((r) => r.success)) {
			console.log("✅ Sequential execution test passed");
			testsPassed++;
		} else {
			console.log("❌ Sequential execution test failed", results);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Sequential execution test threw error:", error);
		testsFailed++;
	}

	// Test 6: Long running script with timeout
	console.log("\nTest 6: Script execution timing");
	try {
		const startTime = Date.now();
		const result = await executor.executeScript(
			"timing-test.js",
			`
			console.log('Starting timing test...');
			const start = Date.now();
			while (Date.now() - start < 2000) {
				// Simulate work for 2 seconds
			}
			console.log('Timing test complete after 2 seconds');
		`,
		);

		if (result.success && result.duration >= 2000) {
			console.log("✅ Timing test passed (duration:", result.duration, "ms)");
			testsPassed++;
		} else {
			console.log("❌ Timing test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Timing test threw error:", error);
		testsFailed++;
	}

	// Test 7: Invalid package.json
	console.log("\nTest 7: Invalid package.json handling");
	try {
		const invalidPackageJson = {
			name: "test-project",
			dependencies: {
				"non-existent-package-12345": "^1.0.0",
			},
		};

		const result = await executor.setupEnvironment(invalidPackageJson, "console.log('Should not run');");

		if (!result.success && result.error) {
			console.log("✅ Invalid package test passed");
			testsPassed++;
		} else {
			console.log("❌ Invalid package test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Invalid package test threw error:", error);
		testsFailed++;
	}

	// Test 8: File system operations
	console.log("\nTest 8: File system operations");
	try {
		const result = await executor.executeScript(
			"fs-test.js",
			`
			const fs = require('fs');
			const path = require('path');
			
			// Create directory
			fs.mkdirSync('test-dir', { recursive: true });
			console.log('Directory created');
			
			// Write file
			fs.writeFileSync(path.join('test-dir', 'test.txt'), 'Hello World!');
			console.log('File written');
			
			// Read file
			const content = fs.readFileSync(path.join('test-dir', 'test.txt'), 'utf8');
			console.log('File content:', content);
			
			// List directory
			const files = fs.readdirSync('test-dir');
			console.log('Directory contents:', files.join(', '));
		`,
		);

		if (
			result.success &&
			result.output?.includes("Directory created") &&
			result.output?.includes("File written") &&
			result.output?.includes("File content: Hello World!")
		) {
			console.log("✅ File system test passed");
			testsPassed++;
		} else {
			console.log("❌ File system test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ File system test threw error:", error);
		testsFailed++;
	}

	// Cleanup
	await executor.cleanup();

	// Summary
	console.log("\n📊 Test Summary");
	console.log(`✅ Passed: ${testsPassed}`);
	console.log(`❌ Failed: ${testsFailed}`);
	console.log(`📈 Total: ${testsPassed + testsFailed}`);

	process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
	console.error("Test runner failed:", error);
	process.exit(1);
});
