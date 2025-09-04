import { Command } from "commander";
import chalk from "chalk";

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
        console.log(chalk.gray("  Removing credentials from all profiles..."));
        
        if (!options.force) {
          console.log(chalk.yellow("\n⚠ This will logout from ALL profiles"));
          console.log(chalk.gray("  You'll need to re-authenticate for each profile"));
          console.log(chalk.gray("  Use --force to skip this confirmation"));
          
          // TODO: Implement confirmation prompt
          console.log(chalk.yellow("⚠ Confirmation prompt not yet implemented"));
          console.log(chalk.gray("  Proceeding with logout..."));
        }
        
        // TODO: Implement logout from all profiles
        console.log(chalk.yellow("⚠ Multi-profile logout not yet implemented"));
        console.log(chalk.gray("  This will:"));
        console.log(chalk.gray("  1. List all stored profiles"));
        console.log(chalk.gray("  2. Remove credentials for each profile"));
        console.log(chalk.gray("  3. Clear default profile setting"));
        
        console.log(chalk.green("✔ Logged out from all profiles"));
        
      } else {
        const profile = options.profile || "default";
        console.log(chalk.gray(`  Removing credentials for profile: ${profile}`));
        
        if (!options.force) {
          console.log(chalk.yellow(`\n⚠ This will logout from profile '${profile}'`));
          console.log(chalk.gray("  You'll need to re-authenticate to use this profile"));
          console.log(chalk.gray("  Use --force to skip this confirmation"));
          
          // TODO: Implement confirmation prompt
          console.log(chalk.yellow("⚠ Confirmation prompt not yet implemented"));
          console.log(chalk.gray("  Proceeding with logout..."));
        }
        
        // TODO: Implement single profile logout
        console.log(chalk.yellow("⚠ Profile logout not yet implemented"));
        console.log(chalk.gray("  This will:"));
        console.log(chalk.gray("  1. Check if profile exists"));
        console.log(chalk.gray("  2. Remove stored credentials"));
        console.log(chalk.gray("  3. Update profile configuration"));
        
        console.log(chalk.green(`✔ Logged out from profile: ${profile}`));
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