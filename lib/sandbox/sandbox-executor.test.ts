import { SandboxExecutor } from "./sandbox-executor";

async function runTests() {
	console.log("🧪 Starting Sandbox Executor Tests\n");

	const executor = new SandboxExecutor();
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

		if (!result.success && result.exitCode !== 0) {
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
		const _startTime = Date.now();
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
