import select from "@inquirer/select";
import { Command } from "commander";
import open from "open";
import ora from "ora";
import pc from "picocolors";
import { listOrganizations, setupOrg } from "../lib/api.js";
import { startAuthServer } from "../lib/auth-server.js";
import { getBaseUrl, getConfig, saveConfig } from "../lib/config.js";

export const loginCommand = new Command("login")
  .description("Authenticate with Lightfast and select an organization")
  .action(async () => {
    const existing = getConfig();
    if (existing && existing.orgName !== "env") {
      console.log(`  Currently linked to: ${pc.bold(existing.orgName)}`);
      console.log();
    }

    // Step 1: Start localhost server
    const { port, state, waitForToken } = await startAuthServer();
    const authUrl = `${getBaseUrl()}/cli/auth?port=${port}&state=${encodeURIComponent(state)}`;

    console.log("  Opening browser to authenticate...");
    console.log(pc.dim(`  If it doesn't open, visit: ${authUrl}`));
    console.log();

    try {
      await open(authUrl);
    } catch {
      // Browser didn't open — user will use the URL manually
    }

    // Step 2: Wait for JWT callback
    const authSpinner = ora("Waiting for authentication...").start();
    const { token: jwt } = await waitForToken();
    authSpinner.succeed("Authenticated!");
    console.log();

    // Step 3: List organizations
    const orgSpinner = ora("Fetching organizations...").start();
    let orgs: Awaited<ReturnType<typeof listOrganizations>>;
    try {
      orgs = await listOrganizations(jwt);
    } catch {
      orgSpinner.fail("Failed to fetch organizations. Please try again.");
      process.exit(1);
    }
    orgSpinner.stop();

    if (orgs.length === 0) {
      console.log(
        pc.yellow("  No organizations found. Create one at lightfast.ai first.")
      );
      process.exit(1);
    }

    // Step 4: Interactive org selection
    const selectedOrgId = await select({
      message: "Which organization?",
      choices: orgs.map((org) => ({
        name: `${org.name} (${org.slug})`,
        value: org.id,
      })),
    });

    // Step 5: Create API key
    const setupSpinner = ora("Setting up...").start();
    let result: Awaited<ReturnType<typeof setupOrg>>;
    try {
      result = await setupOrg(jwt, selectedOrgId);
    } catch {
      setupSpinner.fail("Session expired. Please run `lightfast login` again.");
      process.exit(1);
    }
    setupSpinner.succeed(`Linked to ${pc.bold(result.orgName)}!`);

    // Step 6: Save config
    saveConfig({
      orgId: result.orgId,
      orgSlug: result.orgSlug,
      orgName: result.orgName,
      apiKey: result.apiKey,
    });

    console.log();
    console.log(
      `  Run ${pc.cyan("lightfast listen")} to stream webhook events.`
    );
  });
