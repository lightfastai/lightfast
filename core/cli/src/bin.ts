#!/usr/bin/env node

/**
 * CLI binary entrypoint
 * 
 * Sets up commander and registers all commands.
 */

import { Command } from "commander";

const program = new Command();

program
  .name("lightfast")
  .description("CLI for Lightfast configuration and testing")
  .version("0.1.0");

// Commands will be registered here in next phase
// program.addCommand(validateCommand);
// program.addCommand(testSearchCommand);

program.parse();
