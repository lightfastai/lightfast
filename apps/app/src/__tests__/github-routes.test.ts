import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("app GitHub API routes", () => {
  it("mounts GitHub OAuth callbacks through explicit api/app handlers", () => {
    const setupCallbackSource = source("src/routes/api/github/setup.ts");
    const oauthCallbackSource = source(
      "src/routes/api/github/oauth/callback.ts"
    );
    const userOAuthCallbackSource = source(
      "src/routes/api/github/user/oauth/callback.ts"
    );
    const githubOAuthAdapterSource = repoSource(
      "api/app/src/adapters/internal/github-oauth.ts"
    );
    const apiPackageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, { default: string; types: string }>;
    };

    expect(setupCallbackSource).toContain(
      'createFileRoute("/api/github/setup")'
    );
    expect(setupCallbackSource).toContain(
      '@api/app/internal-api/github-oauth"'
    );
    expect(setupCallbackSource).toContain(
      "handleGitHubInstallationSetupRequest"
    );
    expect(setupCallbackSource).not.toContain(
      "completeGitHubInstallationSetup"
    );
    expect(setupCallbackSource).not.toContain("Response.redirect");

    expect(oauthCallbackSource).toContain(
      'createFileRoute("/api/github/oauth/callback")'
    );
    expect(oauthCallbackSource).toContain(
      '@api/app/internal-api/github-oauth"'
    );
    expect(oauthCallbackSource).toContain("handleGitHubOAuthCallbackRequest");
    expect(oauthCallbackSource).not.toContain(
      "completeGitHubOAuthVerification"
    );
    expect(oauthCallbackSource).not.toContain("Response.redirect");

    expect(userOAuthCallbackSource).toContain(
      'createFileRoute("/api/github/user/oauth/callback")'
    );
    expect(userOAuthCallbackSource).toContain(
      '@api/app/internal-api/github-oauth"'
    );
    expect(userOAuthCallbackSource).toContain(
      "handleGitHubUserAccountOAuthCallbackRequest"
    );
    expect(userOAuthCallbackSource).not.toContain(
      "completeGitHubUserAccountOAuth"
    );
    expect(userOAuthCallbackSource).not.toContain("Response.redirect");

    expect(apiPackageJson.exports["./internal-api/github-oauth"]).toEqual({
      default: "./src/adapters/internal/github-oauth.ts",
      types: "./src/adapters/internal/github-oauth.ts",
    });
    expect(githubOAuthAdapterSource).toContain(
      "completeGitHubInstallationSetup"
    );
    expect(githubOAuthAdapterSource).toContain(
      "completeGitHubOAuthVerification"
    );
    expect(githubOAuthAdapterSource).toContain(
      "completeGitHubUserAccountOAuth"
    );
    expect(githubOAuthAdapterSource).toContain("Response.redirect");

    for (const routeSource of [
      setupCallbackSource,
      oauthCallbackSource,
      userOAuthCallbackSource,
      githubOAuthAdapterSource,
    ]) {
      expect(routeSource).not.toContain("next/");
    }
  });
});
