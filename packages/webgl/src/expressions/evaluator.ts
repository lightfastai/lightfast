import type { TimeContext } from "./types";

/**
 * Helper to identify values that are expressions (strings)
 * @param value Any value to check
 * @returns True if the value is a string (expression)
 */
export function isExpression(value: any): value is string {
  return typeof value === "string";
}

/**
 * Evaluates a value that can be either a number or an expression
 * If it's a number, returns it directly
 * If it's an expression string, evaluates it with the given context
 *
 * @param value The value to evaluate (number or expression string)
 * @param context Time context with variables available to the expression
 * @returns The evaluated numeric value
 */
export function evaluateValue(
  value: number | string,
  context: TimeContext,
): number {
  // If it's already a number, return it directly
  if (typeof value === "number") {
    return value;
  }

  return evaluateExpression(value, context);
}

/**
 * Evaluates a uniform value with expression support
 * This handles scalar values, vector components, and other more complex structures
 *
 * @param uniformValue The uniform value to evaluate
 * @param path The path to the specific value to evaluate (e.g., 'x' for a vector)
 * @param expressionValue The expression to evaluate
 * @param context Time context with variables
 * @returns The evaluated value
 */
export function evaluateUniformValue(
  uniformValue: any,
  path: string,
  expressionValue: string,
  context: TimeContext,
): number {
  const result = evaluateExpression(expressionValue, context);

  // Update the property at the path
  if (path) {
    const parts = path.split(".");
    let current = uniformValue;

    // Navigate to the nested property
    for (let i = 0; i < parts.length - 1 && parts[i]; i++) {
      const part = parts[i];
      if (part && current) {
        current = current[part];
      }
    }

    // Update the value
    const lastPart = parts[parts.length - 1];
    if (current && lastPart) {
      current[lastPart] = result;
    }
  }

  return result;
}

/**
 * Core function to evaluate a string expression using the provided context
 *
 * @param expression The expression string to evaluate
 * @param context Time context with variables
 * @returns The evaluated numeric result
 */
export function evaluateExpression(
  expression: string,
  context: TimeContext,
): number {
  try {
    // Create a safe evaluation environment with only the context variables
    // Convert the context to a flat object for easier variable substitution
    const flatContext = flattenContext(context);

    // Build a function with all context variables as parameters
    const paramNames = Object.keys(flatContext);
    const paramValues = Object.values(flatContext);

    // Create a function that evaluates the expression with the context
    const evaluator = new Function(...paramNames, `return ${expression};`);

    // Execute the function with the context values
    return evaluator(...paramValues);
  } catch (error) {
    console.error(`Error evaluating expression: "${expression}"`, error);
    // Return a default safe value if it's time-related
    return expression.includes("time") ? context.time * 0.1 : 0;
  }
}

/**
 * Utility to flatten a nested context object into a flat object with dot notation
 *
 * @param context The nested context object
 * @param prefix Prefix for nested keys
 * @returns A flat object with dot notation for nested properties
 */
function flattenContext(
  context: Record<string, any>,
  prefix = "",
): Record<string, any> {
  return Object.entries(context).reduce(
    (acc, [key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(acc, flattenContext(value, newKey));
      } else {
        // Add leaf values to the result
        acc[newKey] = value;
      }

      return acc;
    },
    {} as Record<string, any>,
  );
}

/**
 * Creates a safe version of an expression by sanitizing it
 *
 * @param expression Raw expression string
 * @returns Sanitized expression string
 */
export function sanitizeExpression(expression: string): string {
  // Remove potentially harmful constructs
  return expression
    .replace(/[;{}]/g, "") // Remove semicolons and braces
    .replace(/\b(eval|Function|setTimeout|setInterval)\b/g, ""); // Remove unsafe functions
}
