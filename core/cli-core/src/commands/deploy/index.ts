import { Command } from "commander";
import chalk from "chalk";
import { createCompiler, CompilationSpinner } from "@lightfastai/compiler";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { profileManager } from "../../profiles/profile-manager.js";
import { createLightfastCloudClient } from "@lightfastai/cloud-client";

interface DeployOptions {
	config?: string;
	profile?: string;
	force?: boolean;
	verbose?: boolean;
}

export const deployCommand = new Command("deploy")
	.description("Deploy agents to Lightfast cloud")
	.option("-c, --config <path>", "Path to lightfast.config.ts file")
	.option("--profile <name>", "Authentication profile to use")
	.option("-f, --force", "Force deployment even if no changes detected")
	.option("-v, --verbose", "Show detailed deployment information")
	.addHelpText(
		"after",
		`
${chalk.cyan("Examples:")}
  $ lightfast deploy                         # Deploy using default profile
  $ lightfast deploy --profile production    # Deploy using production profile

${chalk.cyan("Deployment Process:")}
  1. Validates authentication credentials
  2. Compiles TypeScript configuration
  3. Generates deployment bundles
  4. Uploads to Lightfast cloud platform
  5. Provides deployment URL and status

${chalk.cyan("Authentication:")}
  • Use 'lightfast auth login' to authenticate first
  • Use --profile to deploy with specific credentials
  • Check status with 'lightfast auth status'
`,
	)
	.action(async (options: DeployOptions) => {
		let spinner: CompilationSpinner | null = null;

		try {
			// Step 1: Validate authentication
			console.log(chalk.blue("→ Validating authentication..."));

			const profileName =
				options.profile || (await profileManager.getDefaultProfile());
			const profile = await profileManager.getProfile(profileName);

			if (!profile) {
				console.error(chalk.red("× Authentication required"));
				console.error(chalk.gray(`  Profile '${profileName}' not found`));
				console.error(
					chalk.gray("  Run 'lightfast auth login' to authenticate"),
				);
				if (options.profile) {
					console.error(
						chalk.gray(
							`  Or run 'lightfast auth login --profile ${options.profile}' for this profile`,
						),
					);
				}
				process.exit(1);
			}

			const apiKey = await profileManager.getApiKey(profileName);
			if (!apiKey) {
				console.error(chalk.red("× No API key found"));
				console.error(
					chalk.gray(
						`  Profile '${profileName}' exists but has no stored credentials`,
					),
				);
				console.error(
					chalk.gray("  Run 'lightfast auth login' to authenticate"),
				);
				process.exit(1);
			}

			// Test API connection
			console.log(chalk.gray("  Testing API connection..."));
			const baseUrl = profile.endpoint;
			const apiVersion = await profileManager.getApiVersion(profileName);
			const client = createLightfastCloudClient({ baseUrl, apiKey, apiVersion });
			
			let whoamiResult;
			try {
				whoamiResult = await client.apiKey.validate.mutate({ key: apiKey });
				if (!whoamiResult.valid) {
					throw new Error("API key is not valid");
				}
			} catch (error: any) {
				console.error(chalk.red("× Authentication failed"));
				console.error(chalk.gray(`  Error: ${error.message}`));
				
				if (error.message?.includes("unauthorized") || error.message?.includes("401")) {
					console.error(chalk.gray("  Your API key may have expired or been revoked"));
					console.error(chalk.gray("  Run 'lightfast auth login' to re-authenticate"));
				} else if (error.message?.includes("network") || error.message?.includes("fetch")) {
					console.error(chalk.gray("  Check your internet connection and try again"));
				}

				process.exit(1);
			}

			console.log(chalk.green("√ Authenticated successfully"));
			if (options.verbose) {
				console.log(chalk.gray(`  User ID: ${whoamiResult.userId}`));
				console.log(chalk.gray(`  Profile: ${profileName}`));
				console.log(chalk.gray(`  Key ID: ${whoamiResult.keyId}`));
			}

			// Step 2: Find and validate project configuration
			console.log(chalk.blue("\n→ Preparing project for deployment..."));

			const projectRoot = process.cwd();
			const configPath = options.config || "lightfast.config.ts";
			const resolvedConfigPath = resolve(projectRoot, configPath);

			if (!existsSync(resolvedConfigPath)) {
				console.error(
					chalk.red(`× Configuration file not found: ${configPath}`),
				);
				console.error(
					chalk.gray(
						"  Create a lightfast.config.ts file to define your agents",
					),
				);
				console.error(
					chalk.gray("  See https://docs.lightfast.ai/config for examples"),
				);
				process.exit(1);
			}

			console.log(chalk.gray(`  Config: ${configPath}`));
			console.log(chalk.gray(`  Project: ${projectRoot}`));

			// Step 3: Generate deployment bundles
			spinner = new CompilationSpinner(
				"Compiling and bundling for deployment...",
			);
			spinner.start();

			const compiler = createCompiler({
				baseDir: projectRoot,
				generateBundles: false, // We'll generate bundles explicitly
				useCache: !options.force,
			});

			// First compile the configuration
			const compileResult = await compiler.compile({
				configPath: resolvedConfigPath,
				force: options.force,
			});

			if (compileResult.errors.length > 0) {
				spinner.stop();
				console.error(chalk.red("× Compilation failed"));
				compileResult.errors.forEach((error) => {
					console.error(chalk.red(`  • ${error}`));
				});

				if (compileResult.warnings.length > 0) {
					console.error(chalk.yellow("\nWarnings:"));
					compileResult.warnings.forEach((warning) => {
						console.error(chalk.yellow(`  • ${warning}`));
					});
				}
				process.exit(1);
			}

			// Generate deployment bundles
			const bundleResult = await compiler.generateDeploymentBundles({
				configPath: resolvedConfigPath,
				force: options.force,
			});

			spinner.stop();

			console.log(chalk.green("√ Compilation and bundling completed"));
			if (options.verbose) {
				console.log(
					chalk.gray(`  Bundles generated: ${bundleResult.bundles.length}`),
				);
				bundleResult.bundles.forEach((bundle) => {
					console.log(
						chalk.gray(
							`    - ${bundle.id} (${bundle.hash.substring(0, 8)}...) - ${bundle.size} bytes`,
						),
					);
				});
			}

			console.log(chalk.blue("\n→ Deploying to Lightfast cloud..."));
			console.log(chalk.gray(`  Agents found: ${bundleResult.bundles.length}`));

			// Step 5: Deploy each agent
			const deployResults = [];
			
			for (const [index, bundle] of bundleResult.bundles.entries()) {
				spinner = new CompilationSpinner(`Deploying ${bundle.id} (${index + 1}/${bundleResult.bundles.length})...`);
				spinner.start();

				try {
					// Read bundle content from file
					const bundleContent = readFileSync(bundle.filepath, 'utf-8');
					
					// Try to create first
					const result = await client.deploy.create.mutate({
						apiKey,
						name: bundle.id,
						bundleContent,
						filename: `${bundle.id}-${bundle.hash.substring(0, 8)}.js`,
						contentType: "application/javascript",
					});

					spinner.stop();
					console.log(chalk.green(`✅ ${bundle.id} deployed successfully`));
					deployResults.push({ bundle: bundle.id, status: 'created', result });

				} catch (createError: any) {
					if (createError.data?.code === 'CONFLICT') {
						// Agent exists, try to update
						try {
							// Read bundle content from file
							const bundleContent = readFileSync(bundle.filepath, 'utf-8');
							
							const result = await client.deploy.update.mutate({
								apiKey,
								name: bundle.id,
								bundleContent,
								filename: `${bundle.id}-${bundle.hash.substring(0, 8)}.js`,
								contentType: "application/javascript",
							});

							spinner.stop();
							console.log(chalk.green(`✅ ${bundle.id} updated successfully`));
							deployResults.push({ bundle: bundle.id, status: 'updated', result });

						} catch (updateError: any) {
							spinner.stop();
							console.error(chalk.red(`× Failed to update ${bundle.id}: ${updateError.message}`));
							deployResults.push({ bundle: bundle.id, status: 'failed', error: updateError.message });
						}
					} else {
						spinner.stop();
						console.error(chalk.red(`× Failed to deploy ${bundle.id}: ${createError.message}`));
						deployResults.push({ bundle: bundle.id, status: 'failed', error: createError.message });
					}
				}
			}

			// Summary
			const successful = deployResults.filter(r => r.status === 'created' || r.status === 'updated');
			const failed = deployResults.filter(r => r.status === 'failed');

			console.log(chalk.blue("\n→ Deployment Summary"));
			console.log(chalk.green(`  ✅ ${successful.length} agents deployed successfully`));
			
			if (failed.length > 0) {
				console.log(chalk.red(`  ❌ ${failed.length} agents failed`));
				failed.forEach(f => {
					console.log(chalk.red(`    • ${f.bundle}: ${f.error}`));
				});
			}

			if (options.verbose && successful.length > 0) {
				console.log(chalk.gray("\n  Deployed agents:"));
				successful.forEach(s => {
					console.log(chalk.gray(`    • ${s.bundle} (${s.status})`));
				});
			}

			if (failed.length > 0) {
				process.exit(1);
			}

		} catch (error: any) {
			if (spinner) {
				spinner.stop();
			}

			console.error(chalk.red("× Deployment failed"));

			if (error instanceof Error) {
				console.error(chalk.red("Error:"), error.message);

				// Common error suggestions
				if (error.message.includes("network") || error.message.includes("fetch")) {
					console.error(chalk.gray("\n💡 Troubleshooting:"));
					console.error(chalk.gray("  • Check your internet connection"));
					console.error(chalk.gray("  • Verify Lightfast API is accessible"));
					console.error(chalk.gray("  • Try again in a few moments"));
				} else if (
					error.message.includes("unauthorized") ||
					error.message.includes("401")
				) {
					console.error(chalk.gray("\n💡 Troubleshooting:"));
					console.error(chalk.gray("  • Your API key may have expired"));
					console.error(chalk.gray("  • Run 'lightfast auth login --force' to re-authenticate"));
					console.error(chalk.gray("  • Check 'lightfast auth status' for details"));
				} else if (error.message.includes("compilation")) {
					console.error(chalk.gray("\n💡 Troubleshooting:"));
					console.error(chalk.gray("  • Check your lightfast.config.ts file"));
					console.error(chalk.gray("  • Ensure all agents are properly configured"));
					console.error(chalk.gray("  • Run with --verbose for detailed error output"));
				}
			} else {
				console.error(chalk.red("Unknown error occurred"));
			}

			if (options.verbose && error instanceof Error) {
				console.error(chalk.gray("\nStack trace:"));
				console.error(chalk.gray(error.stack || "No stack trace available"));
			}

			console.error(chalk.gray("\nFor help:"));
			console.error(
				chalk.gray("  • Check documentation: https://docs.lightfast.ai"),
			);
			console.error(
				chalk.gray("  • Verify authentication: lightfast auth status"),
			);
			console.error(chalk.gray("  • Run with --verbose for more details"));

			process.exit(1);
		}
	});
