import { serve } from "@hono/node-server";
import AWS from "aws-sdk";
import { Hono } from "hono";

import { env } from "./env.js";

const app = new Hono();

const s3 = new AWS.S3({
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  region: "auto",
  signatureVersion: "v4",
});

const bucket = "lightfast-media";

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/images/:key", async (c) => {
  const key = c.req.param("key");
  try {
    const s3Object = await s3.getObject({ Bucket: bucket, Key: key }).promise();

    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header(
      "Content-Type",
      s3Object.ContentType || "application/octet-stream",
    );
    return c.body(s3Object.Body as Buffer);
  } catch (err) {
    return c.text("Image not found", 404);
  }
});

serve({
  fetch: app.fetch,
  port: env.PORT,
});

// eslint-disable-next-line no-console
console.log(`Media server running on port ${env.PORT}`);
