#!/usr/bin/env node

/**
 * CLI binary entrypoint
 *
 * Sets up commander and registers all commands.
 */

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { listenCommand } from "./commands/listen.js";

const program = new Command();
program
  .name("lightfast")
  .description("Lightfast CLI — connect to your webhook pipeline")
  .version("0.1.0");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(listenCommand);

program.parse();
