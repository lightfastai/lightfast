import { Command } from "commander";
import { clearConfig, getConfig } from "../lib/config.js";

export const logoutCommand = new Command("logout")
  .description("Clear credentials and unlink organization")
  .action(() => {
    const config = getConfig();
    if (!config) {
      console.log("Not logged in.");
      return;
    }
    clearConfig();
    console.log("Logged out.");
  });
