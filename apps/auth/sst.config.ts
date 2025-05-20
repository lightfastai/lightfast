// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "lightfast-auth",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "cloudflare",
      // providers: { cloudflare: "6.2.0" },
    };
  },
  async run() {
    const env = await import("~/env").then((m) => m.env);
    const kv = new sst.cloudflare.Kv("CloudflareAuthKV");
    const auth = new sst.cloudflare.Worker("CloudflareAuth", {
      handler: "src/auth/issuer",
      link: [kv],
      environment: {
        POSTGRES_URL: env.POSTGRES_URL,
        RESEND_API_KEY: env.RESEND_API_KEY,
        // NODE_ENV: env.NODE_ENV,
      },
      url: true,
    });
    return {
      url: auth.url,
    };
  },
});
