export const getCSSVariableValue = (
  variableName: string,
  defaultValue = 0,
): number => {
  if (typeof window === "undefined") return defaultValue;
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    variableName.trim(),
  );
  return parseFloat(value) || defaultValue;
};
