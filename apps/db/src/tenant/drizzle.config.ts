import { createDrizzleConfig } from "@vendor/db/config";

export default createDrizzleConfig({
  schema: "src/tenant/src/schema.ts",
  out: "./src/tenant/src/migrations",
  isPoolingUrl: true,
});
