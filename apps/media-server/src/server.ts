import { serve } from "@hono/node-server";
import { Hono } from "hono";

// Getting environment variables with defaults for testing
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "test-account";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "test-key";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "test-secret";

// Create Hono app
const app = new Hono();

// Create a mock S3 client for when credentials aren't available
const createS3Client = () => {
  try {
    // Only import AWS if we have real credentials
    if (
      R2_ACCOUNT_ID !== "test-account" &&
      R2_ACCESS_KEY_ID !== "test-key" &&
      R2_SECRET_ACCESS_KEY !== "test-secret"
    ) {
      // Dynamic import to allow the build to succeed even without aws-sdk
      return import("aws-sdk").then((AWS) => {
        console.log("Using real AWS/R2 credentials");
        return new AWS.default.S3({
          endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          region: "auto",
          signatureVersion: "v4",
        });
      });
    }

    // Return a mock S3 client for testing
    console.log("Using mock S3 client (test mode)");
    return Promise.resolve({
      getObject: () => ({
        promise: () =>
          Promise.resolve({
            Body: Buffer.from("Test image data"),
            ContentType: "image/jpeg",
          }),
      }),
    });
  } catch (error) {
    console.error("Failed to create S3 client:", error);
    // Return mock in case of error
    return Promise.resolve({
      getObject: () => ({
        promise: () =>
          Promise.resolve({
            Body: Buffer.from("Test image data"),
            ContentType: "image/jpeg",
          }),
      }),
    });
  }
};

// Define bucket name
const bucket = "lightfast-media";

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      node_env: process.env.NODE_ENV || "development",
      port: PORT,
    },
  });
});

// Images endpoint
app.get("/images/:key", async (c) => {
  const key = c.req.param("key");
  try {
    const s3 = await createS3Client();
    const s3Object = await s3.getObject({ Bucket: bucket, Key: key }).promise();

    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header(
      "Content-Type",
      s3Object.ContentType || "application/octet-stream",
    );
    return c.body(s3Object.Body as Buffer);
  } catch (err) {
    console.error("Error fetching image:", err);
    return c.text("Image not found", 404);
  }
});

// Serve the application
serve({
  fetch: app.fetch,
  port: PORT,
});

// Log startup
console.log(`Media server running on port ${PORT}`);
