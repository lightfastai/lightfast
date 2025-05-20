// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "lightfast-auth-test",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "cloudflare",
    };
  },
  async run() {
    const postgresUrlSecret = new sst.Secret("POSTGRES_URL");
    const resendApiKeySecret = new sst.Secret("RESEND_API_KEY");
    const kv = new sst.cloudflare.Kv("CloudflareAuthKV");
    const auth = new sst.cloudflare.Worker("CloudflareAuth", {
      handler: "src/auth/cf-worker-index",
      link: [kv, postgresUrlSecret, resendApiKeySecret],
      environment: {
        NODE_ENV: process.env.NODE_ENV ?? "development",
      },
      url: true,
    });
    return {
      url: auth.url,
    };
  },
});
