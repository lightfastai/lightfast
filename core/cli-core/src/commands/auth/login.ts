import { Command } from "commander";
import chalk from "chalk";
import { password } from "@inquirer/prompts";
import { profileManager } from "../../profiles/profile-manager.js";
import { createLightfastCloudClient, getCloudUrl } from "@lightfastai/cloud-client";

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
        const existingProfile = await profileManager.getProfile(profile);
        const existingApiKey = await profileManager.getApiKey(profile);
        
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
        console.log(chalk.gray(`  You can find your API key at: ${getCloudUrl('/settings/api-keys')}`));
        
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
      
      // Validate the API key using the new cloud client
      const client = createLightfastCloudClient({ baseUrl: options.baseUrl });
      
      let validationResult: any;
      try {
        validationResult = await client.apiKey.validate.mutate({ key: apiKey });
        
        if (!validationResult.valid) {
          console.error(chalk.red("✖ API key validation failed"));
          console.error(chalk.red("Error: API key is not valid"));
          
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Double-check your API key is correct"));
          console.log(chalk.gray("  • Verify the key hasn't expired"));
          console.log(chalk.gray(`  • Generate a new key at ${getCloudUrl('/settings/api-keys')}`));
          process.exit(1);
        }
        
        console.log(chalk.green("✔ API key is valid!"));
        console.log(chalk.gray(`  User ID: ${validationResult.userId}`));
        console.log(chalk.gray(`  Key ID: ${validationResult.keyId}`));
        
      } catch (error: any) {
        console.error(chalk.red("✖ API key validation failed"));
        
        if (error.data?.code === 'UNAUTHORIZED') {
          console.error(chalk.red("Error: Invalid API key"));
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Double-check your API key is correct"));
          console.log(chalk.gray("  • Verify the key hasn't expired"));
          console.log(chalk.gray(`  • Generate a new key at ${getCloudUrl('/settings/api-keys')}`));
        } else if (error.code === 'INTERNAL_SERVER_ERROR') {
          console.error(chalk.red("Error: Server error"));
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Try again in a few moments"));
          console.log(chalk.gray("  • Check Lightfast status page"));
        } else {
          console.error(chalk.red("Error:"), error.message || "Network error");
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Check your internet connection"));
          console.log(chalk.gray("  • Verify Lightfast API is accessible"));
          console.log(chalk.gray("  • Try again in a few moments"));
        }
        
        process.exit(1);
      }
      
      // Store credentials
      console.log(chalk.gray("  Storing credentials securely..."));
      
      try {
        // Store the API key in auth file (Vercel-style)
        await profileManager.setApiKey(profile, apiKey);
        
        // Store profile information
        await profileManager.setProfile(profile, {
          userId: validationResult.userId,
          endpoint: options.baseUrl, // Store custom base URL if provided
        });
        
        // Set as default profile if it's the first one
        const profiles = await profileManager.listProfiles();
        if (profiles.length === 1) {
          await profileManager.setDefaultProfile(profile);
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