import { Command } from "commander";
import chalk from "chalk";
import { configStore } from "../../lib/config.js";
import { createLightfastCloudClient } from "@lightfastai/cloud-client";
import { getDashboardUrl, getApiUrl } from "../../lib/config-constants.js";

interface WhoamiOptions {
  profile?: string;
  json?: boolean;
  verbose?: boolean;
}

export const whoamiCommand = new Command("whoami")
  .description("Display current user information and authentication details")
  .option("--profile <name>", "Show information for specific profile", "default")
  .option("--json", "Output in JSON format")
  .option("-v, --verbose", "Show detailed authentication information")
  .addHelpText("after", `
${chalk.cyan("Examples:")}
  $ lightfast auth whoami                    # Show current user info
  $ lightfast auth whoami --profile work     # Show info for 'work' profile
  $ lightfast auth whoami --verbose          # Show detailed auth info
  $ lightfast auth whoami --json             # JSON output for scripts

${chalk.cyan("Information Displayed:")}
  • User ID and key information
  • Authentication details
  • Profile configuration
  • API key information (masked)
`)
  .action(async (options: WhoamiOptions) => {
    try {
      const profile = options.profile || "default";
      
      // Check if authenticated
      const storedProfile = await configStore.getProfile(profile);
      const apiKey = await configStore.getApiKey(profile);
      
      if (!storedProfile || !apiKey) {
        if (options.json) {
          console.log(JSON.stringify({
            authenticated: false,
            profile: profile,
            error: "Not authenticated",
            message: "No credentials found for this profile"
          }, null, 2));
          return;
        }
        
        console.log(chalk.blue("→ Lightfast User Information"));
        console.log(chalk.gray(`  Profile: ${profile}`));
        console.log("");
        console.log(chalk.red("❌ Not Authenticated"));
        console.log(chalk.gray("  No credentials found for this profile"));
        console.log("");
        console.log(chalk.cyan("📋 Next Steps:"));
        console.log(chalk.gray("  • Run 'lightfast auth login' to authenticate"));
        console.log(chalk.gray("  • Use 'lightfast auth login --profile <name>' for specific profile"));
        console.log(chalk.gray("  • Check 'lightfast auth status' for authentication details"));
        return;
      }
      
      // Fetch user information from API
      if (!options.json) {
        console.log(chalk.blue("→ Lightfast User Information"));
        console.log(chalk.gray(`  Profile: ${profile}`));
        console.log(chalk.gray("  Fetching user details..."));
        console.log("");
      }
      
      try {
        const apiKey = await configStore.getApiKey(profile);
        if (!apiKey) {
          if (options.json) {
            console.log(JSON.stringify({
              authenticated: false,
              profile: profile,
              error: "NO_API_KEY",
              message: "No API key found for this profile"
            }, null, 2));
            return;
          }
          
          console.error(chalk.red("✖ No API key found"));
          console.error(chalk.gray(`  Run 'lightfast auth login --profile ${profile}' first`));
          process.exit(1);
        }

        const storedProfile = await configStore.getProfile(profile);
        const baseUrl = storedProfile?.endpoint || getApiUrl();
        const client = createLightfastCloudClient({ baseUrl, apiKey });
        
        const userResult = await client.apiKey.validate.mutate({ key: apiKey });
        
        if (!userResult.valid) {
          if (options.json) {
            console.log(JSON.stringify({
              authenticated: false,
              profile: profile,
              error: "INVALID_API_KEY",
              message: "API key is not valid"
            }, null, 2));
            return;
          }
          
          console.log(chalk.red("✖ Failed to fetch user information"));
          console.log(chalk.red("Error: API key is not valid"));
          
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Your credentials may have expired"));
          console.log(chalk.gray("  • Run 'lightfast auth login --force' to re-authenticate"));
          console.log(chalk.gray("  • Check 'lightfast auth status' for more details"));
          
          process.exit(1);
        }
        
        const maskedApiKey = apiKey ? `${apiKey.slice(0, 6)}****${apiKey.slice(-4)}` : 'Unknown';
        
        if (options.json) {
          console.log(JSON.stringify({
            authenticated: true,
            profile: profile,
            userId: userResult.userId,
            keyId: userResult.keyId,
            apiKey: maskedApiKey,
            lastLogin: storedProfile?.updatedAt,
            endpoint: baseUrl
          }, null, 2));
          return;
        }
        
        // Console output
        console.log(chalk.green("✔ Successfully Authenticated"));
        console.log("");
        
        console.log(chalk.cyan("👤 User Information:"));
        console.log(chalk.gray(`  User ID: ${userResult.userId}`));
        console.log(chalk.gray(`  Key ID: ${userResult.keyId}`));
        
        console.log("");
        console.log(chalk.cyan("🔑 Authentication Details:"));
        console.log(chalk.gray(`  Profile: ${profile}`));
        console.log(chalk.gray(`  API Key: ${maskedApiKey}`));
        console.log(chalk.gray(`  Endpoint: ${baseUrl}`));
        console.log(chalk.gray(`  Last Login: ${storedProfile?.updatedAt ? new Date(storedProfile.updatedAt).toLocaleString() : 'Unknown'}`));
        
        if (options.verbose) {
          console.log("");
          console.log(chalk.cyan("🔧 Additional Information:"));
          console.log(chalk.gray(`  Profile Created: ${storedProfile?.createdAt ? new Date(storedProfile.createdAt).toLocaleString() : 'Unknown'}`));
          console.log(chalk.gray(`  Config Path: ${configStore.getConfigPath()}`));
          
          const authPath = configStore.getAuthPath();
          console.log(chalk.gray(`  Auth File: ${authPath}`));
          console.log(chalk.gray(`  Storage: File-based with chmod 600`));
          
          if (storedProfile) {
            const allProfiles = await configStore.listProfiles();
            const defaultProfile = await configStore.getDefaultProfile();
            console.log(chalk.gray(`  Available Profiles: ${allProfiles.join(", ")}`));
            console.log(chalk.gray(`  Default Profile: ${defaultProfile}`));
          }
        }
        
        console.log("");
        console.log(chalk.cyan("📋 Available Actions:"));
        console.log(chalk.gray(`  • Visit ${getDashboardUrl()} to manage your account`));
        console.log(chalk.gray("  • Run 'lightfast auth logout' to remove credentials"));
        console.log(chalk.gray("  • Run 'lightfast auth status --verbose' to check API key validity"));
        
      } catch (fetchError: any) {
        if (options.json) {
          console.log(JSON.stringify({
            authenticated: false,
            profile: profile,
            error: "FetchError",
            message: fetchError.message
          }, null, 2));
          return;
        }
        
        console.log(chalk.red("✖ Failed to fetch user information"));
        console.log(chalk.red("Error:"), fetchError.message);
        
        if (fetchError.message.includes("Profile") && fetchError.message.includes("not found")) {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • The stored profile may be corrupted"));
          console.log(chalk.gray("  • Try 'lightfast auth login --force' to re-authenticate"));
          console.log(chalk.gray("  • Check 'lightfast auth status' for profile information"));
        }
        
        process.exit(1);
      }
      
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ 
          error: true, 
          message: error instanceof Error ? error.message : "Unknown error",
          authenticated: false
        }, null, 2));
        process.exit(1);
      }
      
      console.error(chalk.red("✖ Failed to retrieve user information"));
      
      if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
        
        // Common error suggestions
        if (error.message.includes("unauthorized") || error.message.includes("401")) {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Your credentials may have expired"));
          console.log(chalk.gray("  • Run 'lightfast auth login' to re-authenticate"));
          console.log(chalk.gray("  • Check 'lightfast auth status' for more details"));
        } else if (error.message.includes("network")) {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Check your internet connection"));
          console.log(chalk.gray("  • Verify Lightfast API is accessible"));
          console.log(chalk.gray("  • Try again in a few moments"));
        }
      } else {
        console.error(chalk.red("Unknown error occurred"));
      }
      
      process.exit(1);
    }
  });