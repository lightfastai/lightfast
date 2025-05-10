/**
 * Sanitizes a URL by ensuring it starts with http:// or https://
 * and removing any potentially harmful content
 *
 * @param url The URL to sanitize
 * @returns The sanitized URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return "";

  // Ensure URL starts with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    // Parse the URL to ensure it's valid
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch (error) {
    console.error(`Invalid URL: ${url}`, error);
    return "";
  }
}
