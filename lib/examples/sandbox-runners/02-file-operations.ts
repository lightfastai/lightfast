/**
 * Example 02: File Operations
 * Demonstrates file creation, reading, writing, and manipulation
 */

import { SandboxExecutor } from "@/lib/sandbox/sandbox-executor";

export async function fileOperationExamples() {
	const executor = new SandboxExecutor();

	console.log("📁 File Operation Examples\n");

	// Example 1: Write files
	console.log("1. Writing files:");
	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/hello.txt",
			content: "Hello, World!\nThis is a test file.",
		},
		{
			path: "/home/vercel-sandbox/data.json",
			content: JSON.stringify({ name: "Test", value: 42 }, null, 2),
		},
		{
			path: "/home/vercel-sandbox/script.sh",
			content: "#!/bin/bash\necho 'Hello from script!'",
		},
	]);
	console.log("   ✅ Created 3 files");

	// Example 2: Read files
	console.log("\n2. Reading files:");
	const readResult = await executor.readFile("/home/vercel-sandbox/hello.txt");
	console.log("   Content:", readResult.stdout);

	// Example 3: Check file existence
	console.log("\n3. Check file existence:");
	const exists1 = await executor.exists("/home/vercel-sandbox/data.json");
	const exists2 = await executor.exists("/home/vercel-sandbox/missing.txt");
	console.log("   data.json exists:", exists1);
	console.log("   missing.txt exists:", exists2);

	// Example 4: Copy files
	console.log("\n4. Copying files:");
	await executor.copy("/home/vercel-sandbox/hello.txt", "/home/vercel-sandbox/hello-copy.txt");
	const copyExists = await executor.exists("/home/vercel-sandbox/hello-copy.txt");
	console.log("   Copy created:", copyExists);

	// Example 5: Move/rename files
	console.log("\n5. Moving/renaming files:");
	await executor.move("/home/vercel-sandbox/hello-copy.txt", "/home/vercel-sandbox/renamed.txt");
	const moveResult = await executor.exists("/home/vercel-sandbox/renamed.txt");
	console.log("   File renamed:", moveResult);

	// Example 6: Create directory structure
	console.log("\n6. Creating directories:");
	await executor.createDirectory("/home/vercel-sandbox/project/src/components");
	await executor.createDirectory("/home/vercel-sandbox/project/tests");
	await executor.createDirectory("/home/vercel-sandbox/project/docs");

	// List directory contents
	const listResult = await executor.listDirectory("/home/vercel-sandbox/project");
	console.log("   Project structure:");
	console.log(listResult.stdout);

	// Example 7: Working with CSV files
	console.log("\n7. CSV file processing:");
	const csvContent = `id,name,score
1,Alice,95
2,Bob,87
3,Charlie,92`;

	await executor.writeFiles([
		{
			path: "/home/vercel-sandbox/data.csv",
			content: csvContent,
		},
	]);

	// Process CSV with awk
	const avgResult = await executor.runCommand("awk", [
		"-F,",
		'NR>1 {sum+=$3; count++} END {print "Average score:", sum/count}',
		"/home/vercel-sandbox/data.csv",
	]);
	console.log(`   ${avgResult.stdout}`);

	// Example 8: File permissions
	console.log("\n8. File permissions:");
	await executor.runCommand("chmod", ["+x", "/home/vercel-sandbox/script.sh"]);
	const permResult = await executor.runCommand("ls", ["-l", "/home/vercel-sandbox/script.sh"]);
	console.log("   Permissions:", permResult.stdout.trim());

	// Example 9: Clean up files
	console.log("\n9. Cleaning up:");
	await executor.remove("/home/vercel-sandbox/hello.txt");
	await executor.remove("/home/vercel-sandbox/project", true); // recursive
	console.log("   ✅ Files cleaned up");

	await executor.cleanup();
}

// Run if called directly
if (require.main === module) {
	fileOperationExamples().catch(console.error);
}
