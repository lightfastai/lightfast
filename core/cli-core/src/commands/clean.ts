import { Command } from "commander";
import chalk from "chalk";
import { rm, existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const rmAsync = promisify(rm);

interface CleanOptions {
  all?: boolean;
  cache?: boolean;
  dist?: boolean;
  output?: boolean;
}

export const cleanCommand = new Command("clean")
  .description("Clean build artifacts and cache")
  .option("-a, --all", "Clean all artifacts (cache, dist, output)")
  .option("-c, --cache", "Clean only the .lightfast cache directory")
  .option("-d, --dist", "Clean only the dist directory")
  .option("-o, --output", "Clean only the .output directory")
  .action(async (options: CleanOptions) => {
    try {
      const baseDir = process.cwd();
      const cleanAll = options.all || (!options.cache && !options.dist && !options.output);

      console.log(chalk.blue("→ Cleaning build artifacts..."));

      const dirsToClean: { path: string; name: string; shouldClean: boolean }[] = [
        {
          path: join(baseDir, ".lightfast"),
          name: ".lightfast cache",
          shouldClean: cleanAll || !!options.cache,
        },
        {
          path: join(baseDir, "dist"),
          name: "dist",
          shouldClean: cleanAll || !!options.dist,
        },
        {
          path: join(baseDir, ".output"),
          name: ".output",
          shouldClean: cleanAll || !!options.output,
        },
      ];

      let cleanedCount = 0;

      for (const dir of dirsToClean) {
        if (!dir.shouldClean) continue;

        if (existsSync(dir.path)) {
          try {
            await rmAsync(dir.path, { recursive: true, force: true });
            console.log(chalk.green(`✔ Cleaned ${dir.name}`));
            cleanedCount++;
          } catch (error) {
            console.error(chalk.yellow(`⚠ Failed to clean ${dir.name}:`), error);
          }
        } else {
          console.log(chalk.gray(`  ${dir.name} not found (skipped)`));
        }
      }

      if (cleanedCount > 0) {
        console.log(chalk.green(`\n✔ Cleaned ${cleanedCount} director${cleanedCount > 1 ? "ies" : "y"}`));
      } else {
        console.log(chalk.gray("\n  No directories to clean"));
      }
    } catch (error) {
      console.error(chalk.red("✖ Clean failed"));
      console.error(chalk.red("\nError:"), error);
      process.exit(1);
    }
  });
