import "server-only";

export const parseError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return error.message as string;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
};
