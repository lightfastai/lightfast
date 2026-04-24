declare const __CLI_VERSION__: string;

import { Command } from "commander";

const program = new Command();
program.name("lightfast").description("Lightfast CLI").version(__CLI_VERSION__);

program.parse();
