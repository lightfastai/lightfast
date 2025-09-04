#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { compileCommand } from "./commands/compile/index.js";
import { bundleCommand } from "./commands/bundle/index.js";
import { devCommand } from "./commands/dev/index.js";
import { cleanCommand } from "./commands/clean/index.js";
//import { deployCommand } from "./commands/deploy/index.js";
import { authCommand } from "./commands/auth/index.js";
import { getPackageInfo } from "./utils/package.js";

const program = new Command();

// Set up the main program
program
	.name("lightfast")
	.description("CLI for the Lightfast agent execution engine")
	.version(
		getPackageInfo().version,
		"-v, --version",
		"Display version information",
	);

// Register all commands
program.addCommand(compileCommand);
program.addCommand(bundleCommand);
program.addCommand(devCommand);
program.addCommand(cleanCommand);
// program.addCommand(deployCommand);
program.addCommand(authCommand);

// Enhanced help with examples
program.on("--help", () => {
	console.log("");
	console.log(chalk.cyan("Examples:"));
	console.log(
		"  $ lightfast compile                    # Compile TypeScript configuration",
	);
	console.log(
		"  $ lightfast dev                       # Start development server",
	);
	console.log(
		"  $ lightfast bundle                    # Create deployment bundles",
	);
	console.log(
		"  $ lightfast deploy                    # Deploy agents to cloud",
	);
	console.log(
		"  $ lightfast auth login                # Authenticate with Lightfast",
	);
	console.log(
		"  $ lightfast auth status               # Check authentication status",
	);
	console.log("");
	console.log(chalk.cyan("Documentation:"));
	console.log("  https://lightfast.ai/docs");
	console.log("");
});

// Parse arguments and execute
program.parse();
