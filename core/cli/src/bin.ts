#!/usr/bin/env node

declare const __CLI_VERSION__: string;

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { listenCommand } from "./commands/listen.js";

const program = new Command();
program
  .name("lightfast")
  .description("Lightfast CLI — connect to your webhook pipeline")
  .version(__CLI_VERSION__);

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(listenCommand);

program.parse();
