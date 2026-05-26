export class CliAuthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "CliAuthError";
  }
}

export function formatCliError(error: unknown): string {
  if (error instanceof CliAuthError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected Lightfast CLI error.";
}
