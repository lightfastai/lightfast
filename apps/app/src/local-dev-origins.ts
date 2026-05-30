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

function aggregateHostFromAppHost(host: string): string | null {
  if (host === "app.lightfast.localhost") {
    return "lightfast.localhost";
  }

  const suffix = ".app.lightfast.localhost";
  if (!host.endsWith(suffix)) {
    return null;
  }

  return `${host.slice(0, -suffix.length)}.lightfast.localhost`;
}

export function localServerActionHosts(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values.flatMap((value) => {
        const host = localHostFromUrl(value);
        return host ? [host] : [];
      })
    )
  );
}

export function localAllowedDevOrigins(values: readonly string[]): string[] {
  const hosts = new Set<string>();

  for (const value of values) {
    const host = localHostFromUrl(value);
    if (!host) {
      continue;
    }

    hosts.add(host);

    const aggregateHost = aggregateHostFromAppHost(host);
    if (aggregateHost) {
      hosts.add(aggregateHost);
    }
  }

  return Array.from(hosts);
}
