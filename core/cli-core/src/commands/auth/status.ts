import { Command } from "commander";
import chalk from "chalk";
import { configStore } from "../../lib/config.js";
import { LightfastClient } from "../../lib/client.js";
import { getApiUrl, getDashboardUrl } from "../../lib/config-constants.js";

interface StatusOptions {
  profile?: string;
  verbose?: boolean;
  json?: boolean;
}

export const statusCommand = new Command("status")
  .description("Check authentication status and stored credentials")
  .option("--profile <name>", "Check specific profile status")
  .option("-v, --verbose", "Show detailed information")
  .option("--json", "Output in JSON format")
  .addHelpText("after", `
${chalk.cyan("Examples:")}
  $ lightfast auth status                    # Check default profile status
  $ lightfast auth status --profile work     # Check 'work' profile status
  $ lightfast auth status --verbose          # Show detailed information
  $ lightfast auth status --json             # JSON output for scripts

${chalk.cyan("Status Information:")}
  • Authentication state (authenticated/not authenticated)
  • Active profile and available profiles
  • Token expiration (when available)
  • API endpoint configuration
`)
  .action(async (options: StatusOptions) => {
    try {
      const profiles = await configStore.listProfiles();
      const defaultProfile = await configStore.getDefaultProfile();
      const configPath = configStore.getConfigPath();
      const authPath = configStore.getAuthPath();
      
      // Determine which profile to check
      const targetProfile = options.profile || defaultProfile;
      
      // Get profile and API key info
      const profile = await configStore.getProfile(targetProfile);
      const apiKey = await configStore.getApiKey(targetProfile);
      const isAuthenticated = !!(profile && apiKey);
      
      // If JSON output is requested
      if (options.json) {
        const statusData = {
          authenticated: isAuthenticated,
          activeProfile: targetProfile,
          profiles: profiles,
          defaultProfile: defaultProfile,
          authFile: authPath,
          configPath: configPath,
          apiEndpoint: "https://api.lightfast.ai",
          profile: profile,
          lastLogin: profile?.updatedAt || null,
        };
        
        console.log(JSON.stringify(statusData, null, 2));
        return;
      }

      // Console output
      console.log(chalk.blue("→ Lightfast Authentication Status"));
      console.log("");

      if (options.profile) {
        console.log(chalk.gray(`📋 Checking Profile: ${options.profile}`));
      } else {
        console.log(chalk.gray("📋 Checking Default Profile"));
      }
      console.log("");

      // Authentication status
      if (isAuthenticated) {
        console.log(chalk.green("✔ Authenticated"));
        console.log(chalk.gray(`  Profile: ${targetProfile}`));
        console.log(chalk.gray(`  User ID: ${profile.userId || 'Unknown'}`));
        console.log(chalk.gray(`  Last Updated: ${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'Unknown'}`));
        
        // Try to validate the API key if requested
        if (options.verbose) {
          console.log(chalk.gray("  Validating API key..."));
          
          try {
            const client = new LightfastClient({ profileName: targetProfile });
            const validationResult = await client.whoami();
            
            if (validationResult.success) {
              console.log(chalk.green("  ✔ API key is valid"));
              console.log(chalk.gray(`  Connected to: ${client.getBaseUrl()}`));
            } else {
              console.log(chalk.red("  ✖ API key validation failed"));
              console.log(chalk.red(`  Error: ${validationResult.message || validationResult.error}`));
              
              if (validationResult.error === "HTTP 401") {
                console.log(chalk.gray("  Your API key may have expired or been revoked"));
              }
            }
          } catch (validationError: any) {
            console.log(chalk.red("  ✖ Could not validate API key"));
            console.log(chalk.red(`  Error: ${validationError.message}`));
          }
        }
      } else {
        console.log(chalk.red("❌ Not Authenticated"));
        console.log(chalk.gray(`  Profile: ${targetProfile}`));
        console.log(chalk.gray("  Status: No credentials found"));
        
        if (profiles.length > 0) {
          console.log(chalk.gray(`  Available profiles: ${profiles.join(", ")}`));
          if (profiles.includes(targetProfile)) {
            console.log(chalk.gray("  Profile exists but has no stored credentials"));
          }
        }
      }
      
      console.log(chalk.gray(`  API Endpoint: https://api.lightfast.ai`));
      
      if (options.verbose) {
        console.log("");
        console.log(chalk.cyan("📊 Detailed Information:"));
        console.log(chalk.gray(`  Config File: ${configPath}`));
        console.log(chalk.gray(`  Auth File: ${authPath}`));
        console.log(chalk.gray(`  Total Profiles: ${profiles.length}`));
        console.log(chalk.gray(`  Available Profiles: ${profiles.length > 0 ? profiles.join(", ") : 'None'}`));
        console.log(chalk.gray(`  Default Profile: ${defaultProfile}`));
        console.log(chalk.gray("  Storage: File-based with chmod 600 (Vercel-style)"));
        console.log(chalk.gray("  Environment: Set LIGHTFAST_API_KEY to override"));
      }

      console.log("");
      if (isAuthenticated) {
        console.log(chalk.cyan("📋 Available Commands:"));
        console.log(chalk.gray("  • Run 'lightfast auth whoami' to see user details"));
        console.log(chalk.gray("  • Run 'lightfast auth logout' to remove credentials"));
        console.log(chalk.gray(`  • Visit ${getDashboardUrl()} to manage your account`));
      } else {
        console.log(chalk.cyan("📋 Next Steps:"));
        console.log(chalk.gray("  • Run 'lightfast auth login' to authenticate"));
        console.log(chalk.gray("  • Use 'lightfast auth login --api-key <key>' for API key auth"));
        console.log(chalk.gray("  • Check documentation at https://docs.lightfast.ai"));
      }
      
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ 
          error: true, 
          message: error instanceof Error ? error.message : "Unknown error" 
        }, null, 2));
        process.exit(1);
      }
      
      console.error(chalk.red("✖ Failed to check authentication status"));
      
      if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
      } else {
        console.error(chalk.red("Unknown error occurred"));
      }
      
      process.exit(1);
    }
  });