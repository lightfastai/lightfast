#!/usr/bin/env tsx
/**
 * Evaluation Runner Script
 * 
 * Runs all or selected agent evaluations
 * 
 * Usage:
 * npm run eval:all                    # Run all evaluations
 * npm run eval:agent a011             # Run specific agent evaluations
 * npm run eval:category experimental  # Run category evaluations
 */

import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join } from "path";

interface EvalFile {
	path: string;
	agent: string;
	category: string;
	name: string;
}

// Configuration
const EVALS_DIR = join(__dirname);
const BRAINTRUST_FLAGS = "--no-send-logs"; // Change to empty string for production

// Discover all evaluation files
function discoverEvaluations(): EvalFile[] {
	const evaluations: EvalFile[] = [];
	
	function scanDirectory(dir: string, category: string = "") {
		const items = readdirSync(dir);
		
		for (const item of items) {
			const fullPath = join(dir, item);
			const stat = statSync(fullPath);
			
			if (stat.isDirectory()) {
				// Skip shared directory for agent discovery
				if (item === "shared" || item === "results") continue;
				
				const newCategory = category ? `${category}/${item}` : item;
				scanDirectory(fullPath, newCategory);
			} else if (item.endsWith(".eval.ts")) {
				const pathParts = fullPath.replace(EVALS_DIR, "").split("/").filter(Boolean);
				const agent = pathParts[pathParts.length - 2] || "unknown";
				const name = item.replace(".eval.ts", "");
				
				evaluations.push({
					path: fullPath,
					agent,
					category: category.replace(/^agents\//, ""),
					name,
				});
			}
		}
	}
	
	const agentsDir = join(EVALS_DIR, "agents");
	if (statSync(agentsDir).isDirectory()) {
		scanDirectory(agentsDir, "agents");
	}
	
	return evaluations;
}

// Run a single evaluation
function runEvaluation(evalFile: EvalFile, options: { dev?: boolean; port?: number } = {}) {
	const { dev = false, port = 8300 } = options;
	
	let command = `npx braintrust eval`;
	
	if (dev) {
		command += ` --dev --dev-port ${port}`;
	} else {
		command += ` ${BRAINTRUST_FLAGS}`;
	}
	
	command += ` "${evalFile.path}"`;
	
	console.log(`\n🧪 Running evaluation: ${evalFile.category}/${evalFile.agent}/${evalFile.name}`);
	console.log(`📂 Path: ${evalFile.path}`);
	console.log(`🚀 Command: ${command}\n`);
	
	try {
		execSync(command, { stdio: "inherit", cwd: process.cwd() });
		console.log(`✅ Completed: ${evalFile.agent}/${evalFile.name}\n`);
	} catch (error) {
		console.error(`❌ Failed: ${evalFile.agent}/${evalFile.name}`);
		console.error(error);
		console.log("");
	}
}

// Filter evaluations by criteria
function filterEvaluations(evaluations: EvalFile[], filters: {
	agent?: string;
	category?: string;
	name?: string;
}): EvalFile[] {
	return evaluations.filter(eval => {
		if (filters.agent && eval.agent !== filters.agent) return false;
		if (filters.category && !eval.category.includes(filters.category)) return false;
		if (filters.name && eval.name !== filters.name) return false;
		return true;
	});
}

// Main execution
function main() {
	const args = process.argv.slice(2);
	const evaluations = discoverEvaluations();
	
	console.log(`🔍 Discovered ${evaluations.length} evaluation files\n`);
	
	// Parse command line arguments
	const options = {
		dev: args.includes("--dev"),
		port: 8300,
		agent: args.find((arg, i) => args[i - 1] === "--agent"),
		category: args.find((arg, i) => args[i - 1] === "--category"),
		name: args.find((arg, i) => args[i - 1] === "--name"),
		list: args.includes("--list"),
		help: args.includes("--help") || args.includes("-h"),
	};
	
	// Show help
	if (options.help) {
		console.log(`
📊 Mastra Agent Evaluation Runner

Usage:
  npm run eval:all                           # Run all evaluations
  npm run eval:all -- --agent a011          # Run specific agent
  npm run eval:all -- --category experimental  # Run category
  npm run eval:all -- --dev                 # Run with dev UI
  npm run eval:all -- --list                # List available evaluations
  npm run eval:all -- --help                # Show this help

Options:
  --agent <name>      Filter by agent name
  --category <name>   Filter by category (experimental, standalone, pure)
  --name <name>       Filter by evaluation name
  --dev              Run with Braintrust dev UI (port 8300)
  --list             List available evaluations without running
  --help             Show this help message

Examples:
  npm run eval:all -- --agent a011 --dev
  npm run eval:all -- --category experimental
  npm run eval:all -- --agent a011 --name task-management
		`);
		return;
	}
	
	// Filter evaluations
	const filtered = filterEvaluations(evaluations, {
		agent: options.agent,
		category: options.category,
		name: options.name,
	});
	
	// List mode
	if (options.list) {
		console.log("📋 Available Evaluations:\n");
		for (const eval of filtered) {
			console.log(`  ${eval.category}/${eval.agent}/${eval.name}`);
			console.log(`    📂 ${eval.path}\n`);
		}
		return;
	}
	
	// Run evaluations
	if (filtered.length === 0) {
		console.log("⚠️  No evaluations found matching criteria");
		return;
	}
	
	console.log(`🎯 Running ${filtered.length} evaluation(s)...\n`);
	
	for (const evaluation of filtered) {
		runEvaluation(evaluation, { dev: options.dev, port: options.port });
	}
	
	console.log(`🎉 Completed ${filtered.length} evaluation(s)!`);
}

// Run if called directly
if (require.main === module) {
	main();
}

export { discoverEvaluations, runEvaluation, filterEvaluations };