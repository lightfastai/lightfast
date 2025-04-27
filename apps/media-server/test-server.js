// Set environment variables for testing
process.env.PORT = 3000;
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";

// Now import and run the server
import("./dist/server.js").catch((err) => {
  console.error("Error running server:", err);
  process.exit(1);
});
