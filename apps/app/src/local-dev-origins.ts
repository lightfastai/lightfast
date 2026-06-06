const DIRECT_SERVICE_HOST_PREFIXES = new Set([
  "app",
  "db",
  "inngest",
  "mcp",
  "platform",
  "qstash",
  "www",
]);

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
  const { hostname, portSuffix } = splitPortlessHost(host);

  if (hostname === "app.lightfast.localhost") {
    return `lightfast.localhost${portSuffix}`;
  }

  const suffix = ".app.lightfast.localhost";
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  return `${hostname.slice(0, -suffix.length)}.lightfast.localhost${portSuffix}`;
}

function appHostFromAggregateHost(host: string): string | null {
  const { hostname, portSuffix } = splitPortlessHost(host);

  if (hostname === "lightfast.localhost") {
    return `app.lightfast.localhost${portSuffix}`;
  }

  const suffix = ".lightfast.localhost";
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const prefix = hostname.slice(0, -suffix.length);
  if (
    !prefix ||
    prefix.includes(".") ||
    DIRECT_SERVICE_HOST_PREFIXES.has(prefix)
  ) {
    return null;
  }

  return `${prefix}.app.lightfast.localhost${portSuffix}`;
}

function splitPortlessHost(host: string) {
  const [hostname = host, port] = host.split(":", 2);
  return {
    hostname,
    portSuffix: port ? `:${port}` : "",
  };
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

    const appHost = appHostFromAggregateHost(host);
    if (appHost) {
      hosts.add(appHost);
    }
  }

  return Array.from(hosts);
}
