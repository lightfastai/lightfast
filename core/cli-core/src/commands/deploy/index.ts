import { Command } from "commander";
import chalk from "chalk";
import { createCompiler, CompilationSpinner } from "@lightfastai/compiler";
import { resolve, join } from "path";
import { existsSync, readFileSync } from "fs";
import { profileManager } from "../../profiles/profile-manager.js";
import { createLightfastCloudClient } from "@lightfastai/cloud-client";
import { buildCommand } from "../build/index.js";

interface DeployOptions {
	config?: string;
	profile?: string;
	force?: boolean;
	verbose?: boolean;
	build?: boolean;
	dryRun?: boolean;
	skipBuild?: boolean;
}

export const deployCommand = new Command("deploy")
	.description("Deploy agents to Lightfast cloud")
	.option("-c, --config <path>", "Path to lightfast.config.ts file")
	.option("--profile <name>", "Authentication profile to use")
	.option("-f, --force", "Force deployment even if no changes detected")
	.option("-v, --verbose", "Show detailed deployment information")
	.option("--build", "Run production build before deploy (default: true)")
	.option("--skip-build", "Skip build step and use existing bundles")
	.option("--dry-run", "Validate and preview deployment without uploading")
	.addHelpText(
		"after",
		`
${chalk.cyan("Examples:")}
  $ lightfast deploy                         # Build and deploy using default profile
  $ lightfast deploy --profile production    # Deploy using production profile
  $ lightfast deploy --skip-build           # Deploy existing bundles without rebuilding
  $ lightfast deploy --dry-run              # Preview deployment without uploading

${chalk.cyan("Deployment Process:")}
  1. Validates authentication credentials
  2. Runs production build (unless --skip-build)
  3. Loads built agent bundles from manifest
  4. Uploads individual agent bundles to cloud
  5. Creates agent registry entries
  6. Provides deployment summary and URLs

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

			if (options.verbose) {
				console.log(chalk.gray(`  Config: ${configPath}`));
				console.log(chalk.gray(`  Project: ${projectRoot}`));
				console.log(chalk.gray(`  Build: ${!options.skipBuild ? 'enabled' : 'skipped'}`));
				console.log(chalk.gray(`  Dry run: ${options.dryRun ? 'enabled' : 'disabled'}`));
			}

			// Step 3: Production build (unless skipped)
			if (!options.skipBuild) {
				console.log(chalk.blue("\n→ Running production build..."));
				
				// Run build command programmatically
				const buildArgs = [
					'build',
					...(options.config ? ['--config', options.config] : []),
					...(options.force ? ['--force'] : []),
					...(options.verbose ? ['--verbose'] : []),
				];
				
				try {
					await buildCommand.parseAsync(buildArgs, { from: 'user' });
				} catch (buildError: any) {
					console.error(chalk.red("× Production build failed"));
					console.error(chalk.gray("  Fix build errors before deploying"));
					process.exit(1);
				}
			} else {
				console.log(chalk.blue("\n→ Using existing bundles (build skipped)..."));
			}

			// Step 4: Load built bundles from manifest
			const manifestPath = join(projectRoot, '.lightfast/dist/manifest.json');
			if (!existsSync(manifestPath)) {
				console.error(chalk.red("× No built bundles found"));
				console.error(chalk.gray("  Run 'lightfast build' first or use --build flag"));
				console.error(chalk.gray(`  Expected manifest at: ${manifestPath}`));
				process.exit(1);
			}

			let manifest;
			try {
				const manifestContent = readFileSync(manifestPath, 'utf-8');
				manifest = JSON.parse(manifestContent);
			} catch (error) {
				console.error(chalk.red("× Failed to read bundle manifest"));
				console.error(chalk.gray(`  Manifest path: ${manifestPath}`));
				console.error(chalk.gray("  Try rebuilding with 'lightfast build'"));
				process.exit(1);
			}

			if (!manifest.bundles || manifest.bundles.length === 0) {
				console.error(chalk.red("× No agent bundles found in manifest"));
				console.error(chalk.gray("  Ensure your lightfast.config.ts defines agents"));
				process.exit(1);
			}

			console.log(chalk.green(`√ Found ${manifest.bundles.length} agent bundles`));
			if (options.verbose) {
				console.log(chalk.gray(`  Manifest version: ${manifest.version}`));
				console.log(chalk.gray(`  Compiled at: ${manifest.compiledAt}`));
				console.log(chalk.gray(`  Compiler version: ${manifest.compilerVersion}`));
			}

			console.log(chalk.blue("\n→ Deploying to Lightfast cloud..."));

			// Step 5: Deploy each agent bundle
			const deployResults = [];
			
			for (const [index, bundleInfo] of manifest.bundles.entries()) {
				const bundlePath = join(projectRoot, '.lightfast/dist', bundleInfo.file);
				
				if (options.dryRun) {
					console.log(chalk.cyan(`${index + 1}/${manifest.bundles.length} Would deploy: ${bundleInfo.id}`));
					console.log(chalk.gray(`   File: ${bundleInfo.file}`));
					console.log(chalk.gray(`   Size: ${bundleInfo.size} bytes`));
					console.log(chalk.gray(`   Hash: ${bundleInfo.hash}`));
					if (bundleInfo.tools?.length > 0) {
						console.log(chalk.gray(`   Tools: ${bundleInfo.tools.join(', ')}`));
					}
					if (bundleInfo.models?.length > 0) {
						console.log(chalk.gray(`   Models: ${bundleInfo.models.join(', ')}`));
					}
					deployResults.push({ bundle: bundleInfo.id, status: 'dry-run', size: bundleInfo.size });
					continue;
				}

				if (!existsSync(bundlePath)) {
					console.error(chalk.red(`× Bundle file not found: ${bundlePath}`));
					deployResults.push({ bundle: bundleInfo.id, status: 'failed', error: 'Bundle file not found' });
					continue;
				}

				spinner = new CompilationSpinner(`Deploying ${bundleInfo.id} (${index + 1}/${manifest.bundles.length})...`);
				spinner.start();

				try {
					// Read bundle content from file
					const bundleContent = readFileSync(bundlePath, 'utf-8');
					
					// Try to create first
					const result = await client.deploy.create.mutate({
						apiKey,
						name: bundleInfo.id,
						bundleContent,
						filename: bundleInfo.file.replace('bundles/', ''),
						contentType: "application/javascript",
					});

					spinner.stop();
					console.log(chalk.green(`✅ ${bundleInfo.id} deployed successfully`));
					deployResults.push({ bundle: bundleInfo.id, status: 'created', result });

				} catch (createError: any) {
					if (createError.data?.code === 'CONFLICT') {
						// Agent exists, try to update
						try {
							const result = await client.deploy.update.mutate({
								apiKey,
								name: bundleInfo.id,
								bundleContent: readFileSync(bundlePath, 'utf-8'),
								filename: bundleInfo.file.replace('bundles/', ''),
								contentType: "application/javascript",
							});

							spinner.stop();
							console.log(chalk.green(`✅ ${bundleInfo.id} updated successfully`));
							deployResults.push({ bundle: bundleInfo.id, status: 'updated', result });

						} catch (updateError: any) {
							spinner.stop();
							console.error(chalk.red(`× Failed to update ${bundleInfo.id}: ${updateError.message}`));
							deployResults.push({ bundle: bundleInfo.id, status: 'failed', error: updateError.message });
						}
					} else {
						spinner.stop();
						console.error(chalk.red(`× Failed to deploy ${bundleInfo.id}: ${createError.message}`));
						deployResults.push({ bundle: bundleInfo.id, status: 'failed', error: createError.message });
					}
				}
			}

			// Step 6: Summary
			const successful = deployResults.filter(r => r.status === 'created' || r.status === 'updated');
			const failed = deployResults.filter(r => r.status === 'failed');
			const dryRun = deployResults.filter(r => r.status === 'dry-run');

			if (options.dryRun) {
				console.log(chalk.blue("\n🔍 Dry Run Summary"));
				console.log(chalk.cyan(`  📋 ${dryRun.length} agents ready for deployment`));
				
				const totalSize = dryRun.reduce((sum, r) => sum + (r.size || 0), 0);
				console.log(chalk.gray(`  📊 Total bundle size: ${Math.round(totalSize / 1024)} KB`));
				
				if (options.verbose) {
					console.log(chalk.gray("\n  Agents to deploy:"));
					dryRun.forEach(d => {
						console.log(chalk.gray(`    • ${d.bundle} (${Math.round((d.size || 0) / 1024)} KB)`));
					});
				}
				
				console.log(chalk.blue("\n✨ Ready for deployment!"));
				console.log(chalk.gray("   Run without --dry-run to deploy to cloud"));
				return;
			}

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

			// Step 7: Success next steps
			if (successful.length > 0 && failed.length === 0) {
				console.log(chalk.blue("\n🚀 All agents deployed successfully!"));
				console.log(chalk.gray("   Your agents are now available in the Lightfast cloud"));
				console.log(chalk.gray("   Visit https://cloud.lightfast.ai to manage and monitor them"));
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
