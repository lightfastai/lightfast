import type { z } from "zod";
import type { ExecutionContext } from "./actor";
import { NotFoundError, ValidationError } from "./errors";

export interface CommandRunArgs<
  TInput,
  TOutput,
  TDeps extends Record<string, unknown>,
> {
  ctx: ExecutionContext;
  deps: TDeps;
  input: TInput;
}

export interface CommandDefinition<
  TName extends string,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TDeps extends Record<string, unknown> = Record<string, never>,
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
  TDeps extends Record<string, unknown> = Record<string, never>,
>(
  definition: CommandDefinition<TName, TInputSchema, TOutputSchema, TDeps>
): CommandDefinition<TName, TInputSchema, TOutputSchema, TDeps> {
  return definition;
}

type AnyCommandDefinition = CommandDefinition<
  string,
  z.ZodTypeAny,
  z.ZodTypeAny,
  Record<string, unknown>
>;

export function defineCommandSurface<
  TSurface extends Record<string, AnyCommandDefinition>,
>(surface: TSurface): TSurface {
  return surface;
}

export async function dispatchCommand<
  TSurface extends Record<string, AnyCommandDefinition>,
  TCommand extends keyof TSurface & string,
>(
  surface: TSurface,
  args: {
    command: TCommand;
    ctx: ExecutionContext;
    deps?: Record<string, unknown>;
    input: unknown;
  }
): Promise<z.infer<TSurface[TCommand]["output"]>> {
  const command = surface[args.command];
  if (!command) {
    throw new NotFoundError(
      "COMMAND_NOT_FOUND",
      `Command ${args.command} was not found.`
    );
  }

  const parsedInput = command.input.safeParse(args.input);
  if (!parsedInput.success) {
    throw new ValidationError("INVALID_COMMAND_INPUT", "Invalid command input.", {
      issues: parsedInput.error.issues,
    });
  }

  const result = await command.run({
    ctx: args.ctx,
    deps: (args.deps ?? {}) as Record<string, unknown>,
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

  return parsedOutput.data;
}
