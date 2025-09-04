import { Command } from "commander";
import chalk from "chalk";
import { createCompiler, CompilationSpinner } from "@lightfastai/compiler";
import { resolve } from "path";
import { existsSync } from "fs";
import { configStore } from "../../lib/config.js";
import { LightfastClient } from "../../lib/client.js";
import { getDashboardUrl } from "../../lib/config-constants.js";

interface DeployOptions {
	config?: string;
	profile?: string;
	name?: string;
	version?: string;
	environment?: "development" | "staging" | "production";
	force?: boolean;
	verbose?: boolean;
}

export const deployCommand = new Command("deploy")
	.description("Deploy agents to Lightfast cloud")
	.option("-c, --config <path>", "Path to lightfast.config.ts file")
	.option("--profile <name>", "Authentication profile to use")
	.option(
		"-n, --name <name>",
		"Deployment name (defaults to package.json name)",
	)
	.option(
		"--version <version>",
		"Deployment version (defaults to package.json version)",
	)
	.option("-e, --environment <env>", "Target environment", "development")
	.option("-f, --force", "Force deployment even if no changes detected")
	.option("-v, --verbose", "Show detailed deployment information")
	.addHelpText(
		"after",
		`
${chalk.cyan("Examples:")}
  $ lightfast deploy                         # Deploy using default profile
  $ lightfast deploy --profile production    # Deploy using production profile
  $ lightfast deploy --name my-agent         # Deploy with specific name
  $ lightfast deploy --version 1.2.3        # Deploy with specific version
  $ lightfast deploy --environment staging   # Deploy to staging environment

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
				options.profile || (await configStore.getDefaultProfile());
			const profile = await configStore.getProfile(profileName);

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

			const apiKey = await configStore.getApiKey(profileName);
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
			const client = new LightfastClient({ profileName });
			const whoamiResult = await client.whoami();

			if (!whoamiResult.success) {
				console.error(chalk.red("× Authentication failed"));
				console.error(
					chalk.gray(`  Error: ${whoamiResult.message || whoamiResult.error}`),
				);

				if (whoamiResult.error === "HTTP 401") {
					console.error(
						chalk.gray("  Your API key may have expired or been revoked"),
					);
					console.error(
						chalk.gray("  Run 'lightfast auth login' to re-authenticate"),
					);
				} else if (whoamiResult.error === "NetworkError") {
					console.error(
						chalk.gray("  Check your internet connection and try again"),
					);
				}

				process.exit(1);
			}

			console.log(chalk.green("√ Authenticated successfully"));
			if (options.verbose) {
				console.log(chalk.gray(`  User: ${whoamiResult.data.email}`));
				console.log(chalk.gray(`  Profile: ${profileName}`));
				if (whoamiResult.data.organization) {
					console.log(
						chalk.gray(
							`  Organization: ${whoamiResult.data.organization.name}`,
						),
					);
				}
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

			// Step 4: Prepare deployment metadata
			const deploymentName = options.name || "lightfast-agent"; // TODO: Extract from package.json
			const deploymentVersion = options.version || "1.0.0"; // TODO: Extract from package.json
			const environment = options.environment || "development";

			console.log(chalk.blue("\n→ Deploying to Lightfast cloud..."));
			console.log(chalk.gray(`  Name: ${deploymentName}`));
			console.log(chalk.gray(`  Version: ${deploymentVersion}`));
			console.log(chalk.gray(`  Environment: ${environment}`));

			// Step 5: Deploy (stub implementation since API doesn't exist yet)
			spinner = new CompilationSpinner("Uploading deployment...");
			spinner.start();

			// TODO: Replace this with actual deployment when API is ready
			const deployResult = await client.deploy({
				name: deploymentName,
				source: bundleResult.outputDir, // This would contain the bundle paths
				environment: environment,
				config: {
					version: deploymentVersion,
					bundles: bundleResult.bundles.map((bundle) => ({
						id: bundle.id,
						hash: bundle.hash,
						path: bundle.path,
						size: bundle.size,
					})),
				},
			});

			spinner.stop();

			if (!deployResult.success) {
				console.error(chalk.red("× Deployment failed"));
				console.error(
					chalk.red(`  Error: ${deployResult.message || deployResult.error}`),
				);

				if (deployResult.error === "HTTP 400") {
					console.error(
						chalk.gray("  Check your deployment configuration and try again"),
					);
				} else if (deployResult.error === "HTTP 403") {
					console.error(
						chalk.gray(
							"  You may not have permission to deploy to this environment",
						),
					);
				} else if (deployResult.error === "HTTP 500") {
					console.error(chalk.gray("  Server error - please try again later"));
				}

				process.exit(1);
			}

			// Step 6: Success output
			console.log(chalk.green("√ Deployment completed successfully!"));
			console.log("");
			console.log(chalk.cyan("📋 Deployment Details:"));
			console.log(
				chalk.gray(`  Deployment ID: ${deployResult.data.deploymentId}`),
			);
			console.log(chalk.gray(`  URL: ${deployResult.data.url}`));
			console.log(chalk.gray(`  Status: ${deployResult.data.status}`));
			console.log(chalk.gray(`  Environment: ${environment}`));

			if (
				deployResult.data.status === "pending" ||
				deployResult.data.status === "building"
			) {
				console.log("");
				console.log(chalk.yellow("⏳ Your deployment is being processed"));
				console.log(
					chalk.gray(
						"  Check status with: lightfast deployments status <deployment-id>",
					),
				);
				console.log(
					chalk.gray(
						"  View logs with: lightfast deployments logs <deployment-id>",
					),
				);
			}

			console.log("");
			console.log(chalk.cyan("📋 Next Steps:"));
			console.log(
				chalk.gray(`  • Monitor your deployment at: ${getDashboardUrl()}`),
			);
			console.log(
				chalk.gray("  • View deployment status: lightfast deployments list"),
			);
			console.log(
				chalk.gray(
					"  • Test your agent: curl -X POST " + deployResult.data.url,
				),
			);
		} catch (error) {
			if (spinner) {
				spinner.stop();
			}

			console.error(chalk.red("× Deployment failed"));

			if (error instanceof Error) {
				console.error(chalk.red("Error:"), error.message);

				// Provide helpful suggestions based on error type
				if (error.message.includes("ENOENT")) {
					console.error(
						chalk.gray("  File not found - check your configuration path"),
					);
				} else if (
					error.message.includes("permission") ||
					error.message.includes("EACCES")
				) {
					console.error(
						chalk.gray(
							"  Permission denied - check file/directory permissions",
						),
					);
				} else if (
					error.message.includes("network") ||
					error.message.includes("fetch")
				) {
					console.error(
						chalk.gray("  Network error - check your internet connection"),
					);
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

