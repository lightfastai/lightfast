import { Command } from "commander";
import chalk from "chalk";
import { password } from "@inquirer/prompts";
import { configStore } from "../../lib/config.js";
import { LightfastClient } from "../../lib/client.js";
import { getDashboardUrl } from "../../lib/config-constants.js";

interface LoginOptions {
  apiKey?: string;
  profile?: string;
  force?: boolean;
  baseUrl?: string;
}

export const loginCommand = new Command("login")
  .description("Authenticate with Lightfast platform")
  .option("--api-key <key>", "API key for authentication")
  .option("--profile <name>", "Profile name to use for this authentication", "default")
  .option("-f, --force", "Force re-authentication even if already logged in")
  .option("--base-url <url>", "Base URL for the Lightfast API (for testing)")
  .addHelpText("after", `
${chalk.cyan("Examples:")}
  $ lightfast auth login                     # Interactive login (opens browser)
  $ lightfast auth login --api-key <key>     # Login with API key directly
  $ lightfast auth login --profile work      # Login to 'work' profile
  $ lightfast auth login --force             # Force re-authentication
  $ lightfast auth login --base-url http://localhost:3000  # Use local API for testing

${chalk.cyan("Authentication Methods:")}
  1. Interactive: Opens browser for OAuth flow
  2. API Key: Direct authentication using API key
  3. Profile-based: Manage multiple authentication profiles
`)
  .action(async (options: LoginOptions) => {
    try {
      const profile = options.profile || "default";
      console.log(chalk.blue("→ Lightfast Authentication"));
      console.log(chalk.gray("  Starting authentication process...\n"));

      // Check if already authenticated and not forcing re-auth
      if (!options.force) {
        const existingProfile = await configStore.getProfile(profile);
        const existingApiKey = await configStore.getApiKey(profile);
        
        if (existingProfile && existingApiKey) {
          console.log(chalk.yellow(`⚠ Already authenticated to profile '${profile}'`));
          console.log(chalk.gray("  Use --force to re-authenticate"));
          console.log(chalk.gray("  Run 'lightfast auth status' to check credentials"));
          return;
        }
      }

      let apiKey: string;
      
      if (options.apiKey) {
        apiKey = options.apiKey;
        console.log(chalk.blue("→ Authenticating with provided API key"));
      } else {
        console.log(chalk.blue("→ Enter your API key for authentication"));
        console.log(chalk.gray(`  You can find your API key at: ${getDashboardUrl('/settings/api-keys')}`));
        
        try {
          apiKey = await password({
            message: "API Key:",
            mask: "*",
            validate: (input: string) => {
              if (!input.trim()) {
                return "API key cannot be empty";
              }
              if (!input.startsWith("lf_")) {
                return "API key must start with 'lf_'";
              }
              return true;
            },
          });
        } catch (error) {
          if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
            console.log(chalk.gray("\n  Authentication cancelled by user"));
            return;
          }
          throw error;
        }
      }

      console.log(chalk.gray(`  Profile: ${profile}`));
      console.log(chalk.gray("  Validating API key..."));
      
      // Validate the API key by calling the API
      const client = new LightfastClient({ baseUrl: options.baseUrl });
      const validationResult = await client.validateApiKey(apiKey);
      
      if (!validationResult.success) {
        console.error(chalk.red("✖ API key validation failed"));
        console.error(chalk.red("Error:"), validationResult.message || validationResult.error);
        
        if (validationResult.error === "HTTP 401" || validationResult.message?.includes("Invalid")) {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Double-check your API key is correct"));
          console.log(chalk.gray("  • Verify the key hasn't expired"));
          console.log(chalk.gray(`  • Generate a new key at ${getDashboardUrl('/settings/api-keys')}`));
        } else if (validationResult.error === "NetworkError") {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Check your internet connection"));
          console.log(chalk.gray("  • Verify Lightfast API is accessible"));
          console.log(chalk.gray("  • Try again in a few moments"));
        }
        
        process.exit(1);
      }
      
      const validationData = validationResult.data;
      console.log(chalk.green("✔ API key is valid!"));
      console.log(chalk.gray(`  User ID: ${validationData?.userId || 'Unknown'}`));
      console.log(chalk.gray(`  Key ID: ${validationData?.keyId || 'Unknown'}`));
      
      // Store credentials
      console.log(chalk.gray("  Storing credentials securely..."));
      
      try {
        // Store the API key in auth file (Vercel-style)
        await configStore.setApiKey(profile, apiKey);
        
        // Store profile information
        await configStore.setProfile(profile, {
          userId: validationData?.userId,
          endpoint: options.baseUrl, // Store custom base URL if provided
        });
        
        // Set as default profile if it's the first one
        const profiles = await configStore.listProfiles();
        if (profiles.length === 1) {
          await configStore.setDefaultProfile(profile);
        }
        
        console.log(chalk.green("✔ Authentication successful!"));
        console.log(chalk.gray(`  Credentials saved to profile: ${profile}`));
        console.log(chalk.gray(`  Auth file: ~/.lightfast/auth.json (mode 600)`));
        
      } catch (storageError: any) {
        console.error(chalk.red("✖ Failed to store credentials"));
        console.error(chalk.red("Error:"), storageError.message);
        
        console.log(chalk.gray("\n💡 Troubleshooting:"));
        console.log(chalk.gray("  • Check if ~/.lightfast directory is writable"));
        console.log(chalk.gray("  • Ensure you have permission to create files"));
        console.log(chalk.gray("  • Try manually creating ~/.lightfast directory"));
        
        process.exit(1);
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