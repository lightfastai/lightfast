export function getRowsAffected(result: unknown): number {
  const value = Array.isArray(result) ? result[0] : result;
  if (value === null || typeof value !== "object") {
    return 0;
  }

  const { affectedRows, rowsAffected } = value as {
    affectedRows?: unknown;
    rowsAffected?: unknown;
  };

  if (typeof rowsAffected === "number") {
    return rowsAffected;
  }
  if (typeof affectedRows === "number") {
    return affectedRows;
  }
  return 0;
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }

  const { body, code, message } = error as {
    body?: { code?: unknown };
    code?: unknown;
    message?: unknown;
  };

  return (
    body?.code === "ER_DUP_ENTRY" ||
    code === "ER_DUP_ENTRY" ||
    (typeof message === "string" && message.includes("Duplicate entry"))
  );
}
