/**
 * Read a truncated error body from a failed HTTP response.
 * Safe to call on any response — catches read failures silently.
 */
export async function readErrorBody(
  response: Response,
  maxLength = 200
): Promise<string> {
  try {
    const text = await response.text();
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  } catch {
    return "";
  }
}
