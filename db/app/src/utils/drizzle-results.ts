export function getRowsAffected(result: unknown): number {
  if (Array.isArray(result)) {
    return result.reduce((total, item) => total + getRowsAffected(item), 0);
  }
  if (result === null || typeof result !== "object") {
    return 0;
  }

  const { affectedRows, rowsAffected } = result as {
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
  return isDuplicateKeyErrorValue(error, new Set<unknown>());
}

function isDuplicateKeyErrorValue(error: unknown, seen: Set<unknown>): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }
  if (seen.has(error)) {
    return false;
  }
  seen.add(error);

  const { body, cause, code, errno, message } = error as {
    body?: { code?: unknown; message?: unknown };
    cause?: unknown;
    code?: unknown;
    errno?: unknown;
    message?: unknown;
  };

  return (
    code === "ER_DUP_ENTRY" ||
    body?.code === "ER_DUP_ENTRY" ||
    errno === 1062 ||
    includesDuplicateEntry(message) ||
    includesDuplicateEntry(body?.message) ||
    isDuplicateKeyErrorValue(cause, seen)
  );
}

function includesDuplicateEntry(value: unknown) {
  return (
    typeof value === "string" &&
    (value.includes("Duplicate entry") || value.includes("errno 1062"))
  );
}
