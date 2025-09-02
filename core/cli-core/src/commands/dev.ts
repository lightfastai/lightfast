import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  createCompiler,
  findConfig,
  createConfigWatcher,
  formatCompilationErrors,
  displayCompilationSummary,
  CompilationSpinner,
} from "@lightfastai/compiler";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

interface DevOptions {
  port?: string
  host?: string
  noWatch?: boolean
  noCompile?: boolean
}

export const devCommand = new Command("dev")
  .description("Start the Lightfast development server")
  .option("-p, --port <port>", "Port to run the server on", "3000")
  .option("-h, --host <host>", "Host to bind the server to", "localhost")
  .option("--no-watch", "Disable file watching for config changes")
  .option("--no-compile", "Disable TypeScript compilation (use existing JS files only)")
  .action(async (options: DevOptions) => {
    console.log(chalk.blue("→ Starting Lightfast server..."));

    try {
      const port = options.port ?? "3000";
      const host = options.host ?? "localhost";

      // Compile TypeScript config if needed
      if (!options.noCompile) {
        const configPath = findConfig(process.cwd());
        if (configPath?.endsWith(".ts")) {
          const spinner = new CompilationSpinner("Compiling TypeScript configuration...");
          spinner.start();

          const compiler = createCompiler({
            baseDir: process.cwd(),
            generateBundles: false, // Only transpile for development
          });

          try {
            const result = await compiler.compile({ configPath });
            spinner.stop();

            if (result.errors.length > 0) {
              // Display formatted errors
              console.error(formatCompilationErrors(result.errors));
              console.error(chalk.yellow("  Continuing with existing configuration if available..."));
            } else {
              // Display success with any warnings
              displayCompilationSummary(
                result.errors,
                result.warnings,
                result.sourcePath,
                result.compilationTime,
              );
            }

            // Start watcher if not disabled
            if (!options.noWatch) {
              console.log(chalk.blue("→ Starting configuration watcher..."));
              const watcher = createConfigWatcher({
                baseDir: process.cwd(),
                compiler,
                debounceDelay: 500,
                ignoreInitial: true, // Skip initial compilation since we already compiled above
                additionalWatchPaths: [configPath],
              });

              watcher.on("compile-start", () => {
                const watchSpinner = new CompilationSpinner("Recompiling configuration...");
                watchSpinner.start();
                // Store spinner reference for later use
                (watcher as { _spinner?: CompilationSpinner })._spinner = watchSpinner;
              });

              watcher.on("compile-success", (result) => {
                const watchSpinner = (watcher as { _spinner?: CompilationSpinner })._spinner;
                if (watchSpinner) {
                  watchSpinner.stop();
                  delete (watcher as { _spinner?: CompilationSpinner })._spinner;
                }
                displayCompilationSummary(
                  result.errors,
                  result.warnings,
                  result.sourcePath,
                  result.compilationTime,
                );
              });

              watcher.on("compile-error", (error, result) => {
                const watchSpinner = (watcher as { _spinner?: CompilationSpinner })._spinner;
                if (watchSpinner) {
                  watchSpinner.stop();
                  delete (watcher as { _spinner?: CompilationSpinner })._spinner;
                }
                if (result?.errors) {
                  console.error(formatCompilationErrors(result.errors));
                } else {
                  console.error(chalk.red("✖ Compilation error:"), error.message);
                }
              });

              await watcher.start();
              console.log(chalk.green("✔ Watching for configuration changes"));

              // Cleanup on exit
              process.on("SIGINT", () => {
                void watcher.stop();
              });
              process.on("SIGTERM", () => {
                void watcher.stop();
              });
            }
          } catch (error) {
            spinner.stop();
            console.error(chalk.red("✖ Failed to compile configuration:"), error);
            console.error(chalk.yellow("  Continuing with existing configuration..."));
          }
        }
      }

      // When running from dist (production/installed), use the built app
      // Check if we're running from a dist folder (either local build or installed package)
      const isProduction = dirname.includes("/dist") || dirname.includes("\\dist");

      if (process.env.DEBUG) {
        console.log(chalk.gray(`Debug: filename = ${filename}`));
        console.log(chalk.gray(`Debug: dirname = ${dirname}`));
        console.log(chalk.gray(`Debug: isProduction = ${String(isProduction)}`));
        console.log(chalk.gray(`Debug: import.meta.url = ${import.meta.url}`));
      }

      let cliRoot: string = process.cwd();
      let startCommand: string[] = [];

      if (isProduction) {
        // Running from installed package - check for bundled dev-server output
        const bundledDevServer = path.resolve(dirname, "dev-server-output/server/index.mjs");

        if (fs.existsSync(bundledDevServer)) {
          // Use bundled dev-server (new bundled approach)
          startCommand = ["node", bundledDevServer];
          cliRoot = path.dirname(bundledDevServer);
          console.log(chalk.blue("→ Starting production server (bundled)..."));
        } else {
          // Fallback to old approach for backward compatibility
          try {
            const devServerPath = require.resolve("@lightfastai/dev-server/.output/server/index.mjs");
            startCommand = ["node", devServerPath];
            cliRoot = path.dirname(devServerPath);
            console.log(chalk.blue("→ Starting production server..."));
          } catch {
            console.error(chalk.red("✖ Dev server not found."));
            console.error(chalk.yellow("  The CLI package may not be properly built."));
            console.error(chalk.yellow("  Try running: pnpm --filter @lightfastai/cli build"));
            process.exit(1);
          }
        }
      } else {
        // Development mode - run dev-server in development
        cliRoot = process.cwd();
        try {
          const devServerPackage = require.resolve("@lightfastai/dev-server/package.json");
          const devServerRoot = path.dirname(devServerPackage);
          startCommand = ["pnpm", "dev", "--port", port, "--host", host];
          cliRoot = devServerRoot;
          console.log(chalk.blue("→ Starting development server..."));
        } catch {
          // Fallback for workspace development
          const fallbackPath = path.resolve(dirname, "..", "..", "dev-server");
          if (fs.existsSync(fallbackPath)) {
            cliRoot = fallbackPath;
            startCommand = ["pnpm", "dev", "--port", port, "--host", host];
            console.log(chalk.blue("→ Starting development server from workspace..."));
          } else {
            console.error(chalk.red("✖ @lightfastai/dev-server not found."));
            process.exit(1);
          }
        }
      }

      console.log(chalk.blue("→ Launching Lightfast UI..."));

      // Run the appropriate command
      if (startCommand.length === 0) {
        console.error(chalk.red("✖ No start command configured"));
        process.exit(1);
      }

      const devProcess: ChildProcess = spawn(startCommand[0], startCommand.slice(1), {
        cwd: cliRoot,
        stdio: "pipe",
        shell: true,
        env: {
          ...process.env,
          PORT: port,
          HOST: host,
          LIGHTFAST_PROJECT_ROOT: process.cwd(), // Pass the original working directory
        },
      });

      let serverStarted = false;

      devProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();

        // Check if server has started (works for both vite and production)
        if ((output.includes("Local:") || output.includes("Listening on")) && !serverStarted) {
          serverStarted = true;
          console.log(chalk.green("✔ Lightfast server started"));

          console.log("");
          console.log(chalk.bold("  🚀 Lightfast CLI Server"));
          console.log("");
          console.log(`  ${chalk.gray("Local:")}    ${chalk.cyan(`http://${host}:${port}`)}`);
          if (host !== "localhost") {
            console.log(`  ${chalk.gray("Network:")}  ${chalk.cyan(`http://${host}:${port}`)}`);
          }
          console.log("");
          console.log(chalk.gray("  View and manage your Lightfast agents in the browser"));
          console.log(chalk.gray("  Press Ctrl+C to stop"));
          console.log("");
        }

        // Show output in debug mode
        if (process.env.DEBUG) {
          console.log(chalk.gray(output));
        }
      });

      devProcess.stderr?.on("data", (data: Buffer) => {
        const error = data.toString();
        // Only show errors, not warnings
        if ((error).toLowerCase().includes("error")) {
          console.error(chalk.red(error));
        } else if (process.env.DEBUG) {
          console.error(chalk.yellow(error));
        }
      });

      devProcess.on("error", (error) => {
        console.error(chalk.red(`✖ Failed to start server: ${error.message}`));
        if (isProduction) {
          console.error(chalk.yellow("  Try reinstalling the package."));
        }
        process.exit(1);
      });

      devProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`✖ Server exited with code ${code}`));
          process.exit(code);
        }
      });

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n\nShutting down Lightfast server..."));
        devProcess.kill("SIGTERM");
        setTimeout(() => {
          devProcess.kill("SIGKILL");
          process.exit(0);
        }, 5000);
      });

      process.on("SIGTERM", () => {
        devProcess.kill("SIGTERM");
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red("✖ Failed to start server"));
      console.error(chalk.red("\nError:"), error);
      process.exit(1);
    }
  });
