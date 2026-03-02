import { Command } from "commander";

declare const __CLI_VERSION__: string;

const program = new Command();

program
  .name("lightfast")
  .description("CLI for the Lightfast platform")
  .version(__CLI_VERSION__);

program.parse();
