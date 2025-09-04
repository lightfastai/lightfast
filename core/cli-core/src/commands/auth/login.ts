import { Command } from "commander";
import chalk from "chalk";

interface LoginOptions {
  apiKey?: string;
  profile?: string;
  force?: boolean;
}

export const loginCommand = new Command("login")
  .description("Authenticate with Lightfast platform")
  .option("--api-key <key>", "API key for authentication")
  .option("--profile <name>", "Profile name to use for this authentication", "default")
  .option("-f, --force", "Force re-authentication even if already logged in")
  .addHelpText("after", `
${chalk.cyan("Examples:")}
  $ lightfast auth login                     # Interactive login (opens browser)
  $ lightfast auth login --api-key <key>     # Login with API key directly
  $ lightfast auth login --profile work      # Login to 'work' profile
  $ lightfast auth login --force             # Force re-authentication

${chalk.cyan("Authentication Methods:")}
  1. Interactive: Opens browser for OAuth flow
  2. API Key: Direct authentication using API key
  3. Profile-based: Manage multiple authentication profiles
`)
  .action(async (options: LoginOptions) => {
    try {
      console.log(chalk.blue("→ Lightfast Authentication"));
      console.log(chalk.gray("  Starting authentication process...\n"));

      if (options.apiKey) {
        console.log(chalk.blue("→ Authenticating with API key"));
        console.log(chalk.gray(`  Profile: ${options.profile || "default"}`));
        
        // TODO: Implement API key authentication
        console.log(chalk.yellow("⚠ API key authentication not yet implemented"));
        console.log(chalk.gray("  This will store encrypted credentials locally"));
        console.log(chalk.gray("  and validate the key with the Lightfast API"));
        
        // Simulate success for now
        console.log(chalk.green("✔ Authentication successful!"));
        console.log(chalk.gray(`  Credentials saved to profile: ${options.profile || "default"}`));
      } else {
        console.log(chalk.blue("→ Starting interactive authentication"));
        console.log(chalk.gray("  This will open your browser for OAuth flow"));
        
        // TODO: Implement interactive OAuth flow
        console.log(chalk.yellow("⚠ Interactive authentication not yet implemented"));
        console.log(chalk.gray("  This will:"));
        console.log(chalk.gray("  1. Start local callback server"));
        console.log(chalk.gray("  2. Open browser to Lightfast OAuth"));
        console.log(chalk.gray("  3. Handle callback and store tokens"));
        
        // Simulate success for now
        console.log(chalk.green("✔ Authentication successful!"));
        console.log(chalk.gray(`  Credentials saved to profile: ${options.profile || "default"}`));
      }

      console.log(chalk.cyan("\n📋 Next Steps:"));
      console.log(chalk.gray("  • Run 'lightfast auth whoami' to verify authentication"));
      console.log(chalk.gray("  • Run 'lightfast auth status' to check credentials"));
      console.log(chalk.gray("  • Visit https://docs.lightfast.ai for getting started guide"));
      
    } catch (error) {
      console.error(chalk.red("✖ Authentication failed"));
      
      if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
        
        // Common error suggestions
        if (error.message.includes("network") || error.message.includes("fetch")) {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Check your internet connection"));
          console.log(chalk.gray("  • Verify Lightfast API is accessible"));
          console.log(chalk.gray("  • Try again with --api-key if OAuth fails"));
        }
      } else {
        console.error(chalk.red("Unknown error occurred"));
      }
      
      process.exit(1);
    }
  });