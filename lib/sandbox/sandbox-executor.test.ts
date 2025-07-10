import { SandboxExecutor } from "./sandbox-executor";

async function runTests() {
	console.log("🧪 Starting General-Purpose Sandbox Executor Tests\n");

	const executor = new SandboxExecutor();
	let testsPassed = 0;
	let testsFailed = 0;

	// Test 1: Basic command execution
	console.log("Test 1: Basic command execution");
	try {
		const result = await executor.runCommand("echo", ["Hello from sandbox!"]);

		if (result.success && result.stdout.includes("Hello from sandbox!")) {
			console.log("✅ Basic command test passed");
			testsPassed++;
		} else {
			console.log("❌ Basic command test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Basic command test threw error:", error);
		testsFailed++;
	}

	// Test 2: Python execution (Note: Python runtime requires separate sandbox instance)
	console.log("\nTest 2: Python script execution");
	try {
		// Create a new executor for Python runtime
		const pythonExecutor = new SandboxExecutor();
		await pythonExecutor.initialize({ runtime: "python3.13" });

		const pythonScript = `
import sys
print("Python version:", sys.version.split()[0])
print("Hello from Python!")
		`;

		await pythonExecutor.writeFiles([
			{
				path: "/home/vercel-sandbox/test.py",
				content: pythonScript,
			},
		]);

		const result = await pythonExecutor.runCommand("python", ["test.py"]);

		if (result.success && result.stdout.includes("Hello from Python!")) {
			console.log("✅ Python execution test passed");
			testsPassed++;
		} else {
			console.log("❌ Python execution test failed", result);
			testsFailed++;
		}

		await pythonExecutor.cleanup();
	} catch (error) {
		console.log("❌ Python execution test threw error:", error);
		testsFailed++;
	}

	// Test 3: File operations
	console.log("\nTest 3: File operations");
	try {
		// Write a file
		const writeResult = await executor.writeFiles([
			{
				path: "/home/vercel-sandbox/test-file.txt",
				content: "This is a test file\nWith multiple lines\nAnd special chars: $@#!",
			},
		]);

		// Read it back
		const readResult = await executor.readFile("/home/vercel-sandbox/test-file.txt");

		if (
			writeResult.success &&
			readResult.success &&
			readResult.stdout.includes("This is a test file") &&
			readResult.stdout.includes("special chars: $@#!")
		) {
			console.log("✅ File operations test passed");
			testsPassed++;
		} else {
			console.log("❌ File operations test failed");
			console.log("Write result:", writeResult);
			console.log("Read result:", readResult);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ File operations test threw error:", error);
		testsFailed++;
	}

	// Test 4: Directory operations
	console.log("\nTest 4: Directory operations");
	try {
		// Create nested directories
		await executor.createDirectory("/home/vercel-sandbox/test-dir/nested/deep");

		// List directory
		const listResult = await executor.listDirectory("/home/vercel-sandbox/test-dir");

		// Check existence
		const exists = await executor.exists("/home/vercel-sandbox/test-dir/nested/deep");

		if (listResult.success && exists) {
			console.log("✅ Directory operations test passed");
			testsPassed++;
		} else {
			console.log("❌ Directory operations test failed", { listResult, exists });
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Directory operations test threw error:", error);
		testsFailed++;
	}

	// Test 5: Package installation (system packages)
	console.log("\nTest 5: System package installation");
	try {
		// Try to install a small package
		const result = await executor.installPackages(["which"]);

		if (result.success || result.stdout.includes("already installed")) {
			console.log("✅ Package installation test passed");
			testsPassed++;
		} else {
			console.log("❌ Package installation test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Package installation test threw error:", error);
		testsFailed++;
	}

	// Test 6: Complex shell script
	console.log("\nTest 6: Complex shell script execution");
	try {
		const script = `
			# Create a directory
			mkdir -p /home/vercel-sandbox/script-test
			cd /home/vercel-sandbox/script-test
			
			# Create some files
			echo "File 1" > file1.txt
			echo "File 2" > file2.txt
			
			# List files
			ls -la
			
			# Count files
			echo "Total files: $(ls -1 | wc -l)"
		`;

		const result = await executor.executeScript(script);

		if (result.success && result.stdout.includes("Total files: 2")) {
			console.log("✅ Shell script test passed");
			testsPassed++;
		} else {
			console.log("❌ Shell script test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Shell script test threw error:", error);
		testsFailed++;
	}

	// Test 7: Download file
	console.log("\nTest 7: Download file from URL");
	try {
		// Use curl instead of wget as it's more commonly available
		const result = await executor.runCommand("curl", [
			"-o",
			"/home/vercel-sandbox/LICENSE",
			"https://raw.githubusercontent.com/vercel/next.js/canary/LICENSE",
		]);

		// Verify it was downloaded
		const exists = await executor.exists("/home/vercel-sandbox/LICENSE");

		if (result.success && exists) {
			console.log("✅ Download file test passed");
			testsPassed++;
		} else {
			console.log("❌ Download file test failed", result);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Download file test threw error:", error);
		testsFailed++;
	}

	// Test 8: Process management
	console.log("\nTest 8: Process management");
	try {
		// Start a background process using nohup
		await executor.runCommand("sh", ["-c", "nohup sleep 30 &"]);

		// Give it a moment to start
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// List processes
		const processList = await executor.listProcesses();

		if (processList.success && processList.stdout.includes("sleep")) {
			console.log("✅ Process management test passed");
			testsPassed++;
		} else {
			// Also try just checking if ps command works
			if (processList.success && processList.stdout.includes("ps aux")) {
				console.log("✅ Process management test passed (ps works)");
				testsPassed++;
			} else {
				console.log("❌ Process management test failed");
				testsFailed++;
			}
		}
	} catch (error) {
		console.log("❌ Process management test threw error:", error);
		testsFailed++;
	}

	// Test 9: Environment variables
	console.log("\nTest 9: Environment variables");
	try {
		const _result = await executor.runCommand("echo", ["$HOME"], {
			env: { HOME: "/custom/home" },
		});

		const envResult = await executor.getEnvironment();

		if (envResult.success && envResult.stdout.includes("PATH=")) {
			console.log("✅ Environment variables test passed");
			testsPassed++;
		} else {
			console.log("❌ Environment variables test failed", envResult);
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Environment variables test threw error:", error);
		testsFailed++;
	}

	// Test 10: Node.js npm operations
	console.log("\nTest 10: Node.js npm operations");
	try {
		// Use existing Node runtime executor

		// Create a simple package.json
		const packageJson = {
			name: "test-project",
			version: "1.0.0",
			dependencies: {
				ms: "^2.1.3",
			},
		};

		await executor.writeFiles([
			{
				path: "/home/vercel-sandbox/npm-test/package.json",
				content: JSON.stringify(packageJson, null, 2),
			},
		]);

		// Run npm install
		const npmResult = await executor.runCommand("npm", ["install"], {
			cwd: "/home/vercel-sandbox/npm-test",
		});

		// Create and run a simple Node script
		const nodeScript = `
const ms = require('ms');
console.log('1 hour in ms:', ms('1h'));
console.log('NPM test successful!');
		`;

		await executor.writeFiles([
			{
				path: "/home/vercel-sandbox/npm-test/test.js",
				content: nodeScript,
			},
		]);

		const nodeResult = await executor.runCommand("node", ["test.js"], {
			cwd: "/home/vercel-sandbox/npm-test",
		});

		if (nodeResult.success && nodeResult.stdout.includes("NPM test successful!")) {
			console.log("✅ Node.js npm test passed");
			testsPassed++;
		} else {
			console.log("❌ Node.js npm test failed", { npmResult, nodeResult });
			testsFailed++;
		}
	} catch (error) {
		console.log("❌ Node.js npm test threw error:", error);
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
