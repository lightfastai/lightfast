import type { z } from "zod";
import type { ExecutionContext } from "./actor";
import { NotFoundError, ValidationError } from "./errors";

export interface CommandRunArgs<TInput, _TOutput, TDeps extends object> {
  ctx: ExecutionContext;
  deps: TDeps;
  input: TInput;
}

export interface CommandDefinition<
  TName extends string,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TDeps extends object = Record<string, never>,
> {
  input: TInputSchema;
  name: TName;
  output: TOutputSchema;
  run: (
    args: CommandRunArgs<z.infer<TInputSchema>, z.infer<TOutputSchema>, TDeps>
  ) => Promise<z.infer<TOutputSchema>>;
}

export function defineCommand<
  TName extends string,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TDeps extends object = Record<string, never>,
>(
  definition: CommandDefinition<TName, TInputSchema, TOutputSchema, TDeps>
): CommandDefinition<TName, TInputSchema, TOutputSchema, TDeps> {
  return definition;
}

type AnyCommandDefinition = CommandDefinition<
  string,
  z.ZodTypeAny,
  z.ZodTypeAny,
  // This erasure is only used by the generic dispatcher/surface registry.
  // Individual command definitions retain their concrete dependency type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

type CommandDeps<TCommand> =
  TCommand extends CommandDefinition<
    string,
    z.ZodTypeAny,
    z.ZodTypeAny,
    infer TDeps
  >
    ? TDeps
    : object;

type CommandOutput<TCommand> =
  TCommand extends CommandDefinition<
    string,
    z.ZodTypeAny,
    infer TOutput,
    object
  >
    ? z.infer<TOutput>
    : unknown;

export function defineCommandSurface<
  TSurface extends Record<string, AnyCommandDefinition>,
>(surface: TSurface): TSurface {
  return surface;
}

export async function dispatchCommand<
  TSurface extends Record<string, AnyCommandDefinition>,
  TCommand extends string,
>(
  surface: TSurface,
  args: {
    command: TCommand;
    ctx: ExecutionContext;
    deps?: TCommand extends keyof TSurface
      ? CommandDeps<TSurface[TCommand]>
      : object;
    input: unknown;
  }
): Promise<
  TCommand extends keyof TSurface ? CommandOutput<TSurface[TCommand]> : unknown
> {
  const command = surface[args.command as keyof TSurface];
  if (!command) {
    throw new NotFoundError(
      "COMMAND_NOT_FOUND",
      `Command ${args.command} was not found.`
    );
  }

  const parsedInput = command.input.safeParse(args.input);
  if (!parsedInput.success) {
    throw new ValidationError(
      "INVALID_COMMAND_INPUT",
      "Invalid command input.",
      {
        issues: parsedInput.error.issues,
      }
    );
  }

  const result = await command.run({
    ctx: args.ctx,
    deps: args.deps ?? {},
    input: parsedInput.data,
  });

  const parsedOutput = command.output.safeParse(result);
  if (!parsedOutput.success) {
    throw new ValidationError(
      "INVALID_COMMAND_OUTPUT",
      "Invalid command output.",
      { issues: parsedOutput.error.issues }
    );
  }

  return parsedOutput.data as TCommand extends keyof TSurface
    ? CommandOutput<TSurface[TCommand]>
    : unknown;
}
