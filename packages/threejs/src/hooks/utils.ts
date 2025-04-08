/**
 * Gets a value from a nested object using a dot-notation path
 * Using a generic to preserve the return type
 */
export const getNestedValue = <T extends Record<string, unknown>, R = unknown>(
  obj: T,
  path: string,
): R | undefined => {
  return path.split(".").reduce<unknown>((current, part) => {
    if (
      current === undefined ||
      current === null ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, obj as unknown) as R | undefined;
};
