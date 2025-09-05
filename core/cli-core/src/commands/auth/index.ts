import { Command } from "commander";
import chalk from "chalk";
import { loginCommand } from "./login.js";
import { logoutCommand } from "./logout.js";
import { statusCommand } from "./status.js";
import { whoamiCommand } from "./whoami.js";

export const authCommand = new Command("auth")
  .description("Authentication commands for Lightfast")
  .addHelpText("after", `
${chalk.cyan("Examples:")}
  $ lightfast auth login                     # Interactive login
  $ lightfast auth login --api-key <key>     # Login with API key
  $ lightfast auth logout                    # Remove stored credentials
  $ lightfast auth status                    # Check authentication status
  $ lightfast auth whoami                    # Show current user information
`)
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(statusCommand)
  .addCommand(whoamiCommand);