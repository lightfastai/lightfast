function localHostFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isLocalhost =
      url.hostname === "localhost" || url.hostname.endsWith(".localhost");
    return isLocalhost ? url.host : null;
  } catch {
    return null;
  }
}

export function localAllowedDevOrigins(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values.flatMap((value) => {
        const host = localHostFromUrl(value);
        return host ? [host] : [];
      })
    )
  );
}
