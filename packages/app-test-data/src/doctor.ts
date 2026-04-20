import { resolveBaseUrl } from "./config";
import { listSandboxProviders } from "./lib/providers";

interface ServiceCheck {
  name: string;
  ok: boolean;
  status: number | null;
  url: string;
}

interface EnvCheck {
  name: string;
  present: boolean;
  var: string;
}

interface DoctorReport {
  envs: EnvCheck[];
  services: ServiceCheck[];
}

async function checkUrl(name: string, url: string): Promise<ServiceCheck> {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    return {
      name,
      url,
      status: response.status,
      ok: response.ok,
    };
  } catch {
    return {
      name,
      url,
      status: null,
      ok: false,
    };
  }
}

export async function doctor(): Promise<DoctorReport> {
  const platformBase = resolveBaseUrl("platform");
  const appBase = resolveBaseUrl("app");
  const services = await Promise.all([
    checkUrl("platform health", `${platformBase}/api/health`),
    checkUrl("platform inngest", `${platformBase}/api/inngest`),
    checkUrl("app ingress proxy", `${appBase}/api/inngest`),
  ]);

  const envs: EnvCheck[] = listSandboxProviders().flatMap(([slug, provider]) =>
    provider.requiredEnvVars.map((name) => ({
      name: `${slug} signing secret`,
      var: name,
      present: Boolean(process.env[name]),
    }))
  );

  return { services, envs };
}
