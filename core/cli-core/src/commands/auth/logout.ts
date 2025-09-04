import { Command } from "commander";
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import { configStore } from "../../lib/config.js";

interface LogoutOptions {
  profile?: string;
  all?: boolean;
  force?: boolean;
}

export const logoutCommand = new Command("logout")
  .description("Remove stored authentication credentials")
  .option("--profile <name>", "Profile to logout from", "default")
  .option("--all", "Logout from all profiles")
  .option("-f, --force", "Skip confirmation prompt")
  .addHelpText("after", `
${chalk.cyan("Examples:")}
  $ lightfast auth logout                    # Logout from default profile
  $ lightfast auth logout --profile work     # Logout from 'work' profile
  $ lightfast auth logout --all              # Logout from all profiles
  $ lightfast auth logout --force            # Skip confirmation

${chalk.cyan("Notes:")}
  This will remove locally stored credentials but won't revoke tokens.
  To revoke tokens, visit the Lightfast dashboard.
`)
  .action(async (options: LogoutOptions) => {
    try {
      console.log(chalk.blue("→ Lightfast Logout"));
      
      if (options.all) {
        console.log(chalk.gray("  Checking stored profiles..."));
        
        const profiles = await configStore.listProfiles();
        if (profiles.length === 0) {
          console.log(chalk.yellow("⚠ No stored profiles found"));
          console.log(chalk.gray("  Nothing to logout from"));
          return;
        }
        
        console.log(chalk.gray(`  Found ${profiles.length} profile(s): ${profiles.join(", ")}`));
        
        if (!options.force) {
          console.log(chalk.yellow("\n⚠ This will logout from ALL profiles"));
          console.log(chalk.gray("  You'll need to re-authenticate for each profile"));
          
          try {
            const shouldProceed = await confirm({
              message: "Are you sure you want to logout from all profiles?",
              default: false,
            });
            
            if (!shouldProceed) {
              console.log(chalk.gray("  Logout cancelled by user"));
              return;
            }
          } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
              console.log(chalk.gray("\n  Logout cancelled by user"));
              return;
            }
            throw error;
          }
        }
        
        console.log(chalk.gray("  Removing all credentials..."));
        
        try {
          await configStore.clear();
          console.log(chalk.green(`✔ Logged out from all ${profiles.length} profile(s)`));
          console.log(chalk.gray("  All stored credentials have been removed"));
        } catch (clearError: any) {
          console.error(chalk.red("✖ Failed to clear all profiles"));
          console.error(chalk.red("Error:"), clearError.message);
          
          if (clearError.message.includes("keychain")) {
            console.log(chalk.gray("\n💡 Note:"));
            console.log(chalk.gray("  Some credentials may still be in your system keychain"));
            console.log(chalk.gray("  You may need to remove them manually"));
          }
          
          process.exit(1);
        }
        
      } else {
        const profile = options.profile || "default";
        console.log(chalk.gray(`  Checking profile: ${profile}`));
        
        // Check if profile exists
        const existingProfile = await configStore.getProfile(profile);
        const existingApiKey = await configStore.getApiKey(profile);
        
        if (!existingProfile && !existingApiKey) {
          console.log(chalk.yellow(`⚠ Profile '${profile}' is not authenticated`));
          console.log(chalk.gray("  Nothing to logout from"));
          return;
        }
        
        if (!options.force) {
          console.log(chalk.yellow(`\n⚠ This will logout from profile '${profile}'`));
          console.log(chalk.gray("  You'll need to re-authenticate to use this profile"));
          
          try {
            const shouldProceed = await confirm({
              message: `Are you sure you want to logout from profile '${profile}'?`,
              default: false,
            });
            
            if (!shouldProceed) {
              console.log(chalk.gray("  Logout cancelled by user"));
              return;
            }
          } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'ExitPromptError') {
              console.log(chalk.gray("\n  Logout cancelled by user"));
              return;
            }
            throw error;
          }
        }
        
        console.log(chalk.gray(`  Removing credentials for profile: ${profile}...`));
        
        try {
          await configStore.removeProfile(profile);
          console.log(chalk.green(`✔ Logged out from profile: ${profile}`));
          console.log(chalk.gray("  Stored credentials have been removed"));
          
          // Check if this was the last profile
          const remainingProfiles = await configStore.listProfiles();
          if (remainingProfiles.length === 0) {
            console.log(chalk.gray("  No profiles remaining"));
          } else {
            const defaultProfile = await configStore.getDefaultProfile();
            console.log(chalk.gray(`  Default profile is now: ${defaultProfile}`));
          }
        } catch (removeError: any) {
          // Check if the error is because the profile doesn't exist
          if (removeError.message.includes("does not exist")) {
            console.log(chalk.yellow(`⚠ Profile '${profile}' was not found`));
            console.log(chalk.gray("  It may have already been removed"));
          } else {
            console.error(chalk.red("✖ Failed to remove profile"));
            console.error(chalk.red("Error:"), removeError.message);
            
            if (removeError.message.includes("keychain")) {
              console.log(chalk.gray("\n💡 Note:"));
              console.log(chalk.gray("  Credentials may still be in your system keychain"));
              console.log(chalk.gray("  You may need to remove them manually"));
            }
            
            process.exit(1);
          }
        }
      }

      console.log(chalk.cyan("\n📋 Next Steps:"));
      console.log(chalk.gray("  • Run 'lightfast auth status' to verify logout"));
      console.log(chalk.gray("  • Run 'lightfast auth login' to authenticate again"));
      console.log(chalk.gray("  • Visit Lightfast dashboard to revoke tokens if needed"));
      
    } catch (error) {
      console.error(chalk.red("✖ Logout failed"));
      
      if (error instanceof Error) {
        console.error(chalk.red("Error:"), error.message);
        
        // Common error suggestions
        if (error.message.includes("profile")) {
          console.log(chalk.gray("\n💡 Troubleshooting:"));
          console.log(chalk.gray("  • Check available profiles with 'lightfast auth status'"));
          console.log(chalk.gray("  • Use --profile to specify correct profile name"));
        }
      } else {
        console.error(chalk.red("Unknown error occurred"));
      }
      
      process.exit(1);
    }
  });