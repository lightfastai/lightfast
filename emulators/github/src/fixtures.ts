import type { GitHubSeedConfig } from "@emulators/github";
import { GITHUB_WEBHOOK_PATH } from "@repo/github-app-contract";

const githubAppPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAouLr+xRpS3PjnON4PW2cgwUUmRpZWBKy22PJrBIJ58MFG9T6
zWcYQlEsxAuKvVSrPLZLcox2cJqySdEeWgXTc4QpAS8S1UMhCUyyHWeWcwwnfvTE
vDM7+oA0nqdry4Ij9N3/mlTFPLyUGCdq6BjBlHFSbb35QvhooauTY2HUDdejmZna
/oi8FlQQOUwxcaG5Uxub8S8z8WENMlAyYffCsZwAJEJFnhE2N2fJJh3zLVDH8tQv
Ze4zvvZ/vobWzNWpwAF1UWr+4+sW4YANiAmNeFWXiRS6caEP35HWYJURWB0AX8xH
kC+86kJ5N9Pi9NJxEZHUJM2M1Pb5Ndnqe4LtKwIDAQABAoIBAFRJB8MMdM/OT+FG
81kV9v71CguPTtv8EQDlSd34F5gNmf8k3gKbbjoitv9a2ZfO0CzCR5gmhsMNyWPZ
CdObYCdOI8mxChXAfr/JKAF/MKKnj2hqT8Ly3/5niNLv3x+XX/O9TB4X71fWXOuC
uhcPeFvPp8+RlgHJeJrvpXyvioL+VshODkPu172ZUzDmYQq2MpU+5h8Cl2P7v/Lu
UBXldyHC7NV3lSnWBOQo0wHJuBRhc/SGs4gQikdM1lsNQzpAfklKVve+diwq3cFS
SlywPv9+pyneqFJaOKDKcX2pQPCUppZct93u5TdZlq2mcyksonkVjzraQcOFqe7c
v3YRV4ECgYEA1+qZTklBNG9EKM3GDzLlD2JuY7howGade/mamdfbJF2ZLimEdr1a
OVK49s791wdcvy9HrVGWRoCR6XCnLRipcS7nagjyov9sKuUyHca+MMwGhtBoZUvo
vKGe+tIcEXN0Dx2V7Uf4TKjZV4KEbwKsI9k8oszCaKKSKpe4c3PKS8kCgYEAwSAU
P4M8kj97hA8c6ryowUkjn0QArlBXb8ZHx/m75MAoJyDvnIAf5c6oPsivtQOEut+7
T6lramBW9NFhGFhJ/W4R46aE76alnkpUfc3Gl+tQpUfgy96eslYFj9MeAAAJF5Wm
B7TuR85vIBVazOfS/nyTNmnogI1ogpxjqrRBA1MCgYAaZ++N2nml/wGX9+qEC1Zm
NkSH35K4DRSvh8w3imWbofLM6XjwyKGTJyHF1XTH6neWTiL2+GZnguvVX9iiNETs
ua7FkgiSlKhW6qbha1/xOdKGhFBwKwNwpld6F14laDhGbPjcBxQ/09qY0DaAGRSS
Ycv/oQkZoOA9Y0bEn+GauQKBgQCMIHqQmuiYNPeqGk0hBUJs/GScavsTf7fxoizz
LIDouYRo37z8EPsUA56P742OCb+E2FFQu9z0knKFsGaDA4ysFfFk/K34NTJ2Z/hm
T6iJEnSxeDXjtuPvAfuHH+fkmCIAutR9Qwqhj2eSH+yCQLMXc8xc7vuESxZJrq+i
bKe/gQKBgGo3znkV7ciSGu6IKaOc14C6QzMFY1AJo0CvpK3lPXg90lq5Qc9YlJKZ
2Nu8V5rwDRADT5aHUCAHmsUMAHsSgz0q/vQGScrVGXx9t7lgJtCQqeQAgvP6mkES
cjljNGHUA1K2apyhpQxvm6BtdXY3ZDIMXLav6ZbUtvjZibC9cDNb
-----END RSA PRIVATE KEY-----`;

export const GITHUB_EMULATOR_FIXTURES = {
  origin: "http://127.0.0.1:4567",
  githubUserLogin: "lightfast-dev",
  githubUserEmail: "lightfast-dev@example.test",
  githubOrgLogin: "lightfast-emulated",
  githubRepoName: "workspace",
  oauthClientId: "Iv1.lightfastlocal",
  oauthClientSecret: "lightfast-local-secret",
  githubAppId: 424_242,
  githubAppSlug: "lightfast-local",
  githubAppName: "Lightfast Local",
  githubAppPrivateKey: githubAppPrivateKey.trim(),
  githubWebhookSecret: "lightfast-local-webhook-secret",
  installationId: 1001,
  userToken: "test_token_lightfast",
} as const;

export function createGitHubEmulatorSeed(
  appOrigin = "https://lightfast.localhost"
): GitHubSeedConfig {
  const oauthCallbackUrl = new URL("/api/github/oauth/callback", appOrigin);
  const userAccountCallbackUrl = new URL(
    "/api/github/user/oauth/callback",
    appOrigin
  );
  const webhookUrl = new URL(GITHUB_WEBHOOK_PATH, appOrigin);

  return {
    users: [
      {
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        name: "Lightfast Dev",
        email: GITHUB_EMULATOR_FIXTURES.githubUserEmail,
      },
    ],
    orgs: [
      {
        login: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        name: "Lightfast Emulated",
        email: "engineering@example.test",
      },
    ],
    tokens: {
      [GITHUB_EMULATOR_FIXTURES.userToken]: {
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        scopes: ["repo", "user", "read:org", "admin:org"],
      },
    },
    repos: [
      {
        owner: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        name: GITHUB_EMULATOR_FIXTURES.githubRepoName,
        private: true,
        language: "TypeScript",
        auto_init: true,
      },
      {
        owner: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
        name: "api-service",
        private: false,
        language: "TypeScript",
        auto_init: true,
      },
    ],
    oauth_apps: [
      {
        client_id: GITHUB_EMULATOR_FIXTURES.oauthClientId,
        client_secret: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
        name: "Lightfast Local OAuth",
        redirect_uris: [
          oauthCallbackUrl.toString(),
          userAccountCallbackUrl.toString(),
        ],
      },
    ],
    apps: [
      {
        app_id: GITHUB_EMULATOR_FIXTURES.githubAppId,
        slug: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
        name: GITHUB_EMULATOR_FIXTURES.githubAppName,
        private_key: GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey,
        webhook_url: webhookUrl.toString(),
        webhook_secret: GITHUB_EMULATOR_FIXTURES.githubWebhookSecret,
        permissions: {
          contents: "read",
          issues: "read",
          metadata: "read",
          pull_requests: "read",
        },
        events: ["issues", "pull_request", "push"],
        installations: [
          {
            installation_id: GITHUB_EMULATOR_FIXTURES.installationId,
            account: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
            repository_selection: "all",
          },
        ],
      },
    ],
  };
}

export function getGitHubEmulatorEnv(
  _appOrigin: string,
  emulatorOrigin: string = GITHUB_EMULATOR_FIXTURES.origin
) {
  return {
    GITHUB_APP_ID: String(GITHUB_EMULATOR_FIXTURES.githubAppId),
    GITHUB_APP_SLUG: GITHUB_EMULATOR_FIXTURES.githubAppSlug,
    GITHUB_API_VERSION: "2022-11-28",
    GITHUB_APP_CLIENT_ID: GITHUB_EMULATOR_FIXTURES.oauthClientId,
    GITHUB_APP_CLIENT_SECRET: GITHUB_EMULATOR_FIXTURES.oauthClientSecret,
    GITHUB_APP_ENDPOINT_ORIGIN: emulatorOrigin,
    GITHUB_APP_PRIVATE_KEY:
      GITHUB_EMULATOR_FIXTURES.githubAppPrivateKey.replace(/\n/g, "\\n"),
    GITHUB_APP_WEBHOOK_SECRET: GITHUB_EMULATOR_FIXTURES.githubWebhookSecret,
  };
}

const ENV_ASSIGNMENT_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatGitHubEmulatorEnvString(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => {
      if (!ENV_ASSIGNMENT_NAME_RE.test(key)) {
        throw new Error(`Invalid environment variable name: ${key}`);
      }
      if (value.includes("\0")) {
        throw new Error(
          `Environment variable ${key} contains a NUL byte and cannot be passed to env -S`
        );
      }
      return `${key}=${shellQuote(value)}`;
    })
    .join("\n");
}
