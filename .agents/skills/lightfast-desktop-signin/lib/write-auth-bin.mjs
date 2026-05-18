// Headless Electron helper: encrypt a Clerk JWT with safeStorage and write
// it to the desktop app's auth.bin, then exit. The desktop app reads this
// file on startup (apps/desktop/src/main/auth-store.ts) and boots into the
// signed-in state.
//
// Why Electron and not plain node: safeStorage is keychain-bound. Only an
// Electron process running under the same OS user *and* the same
// `app.getName()` can produce ciphertext the desktop app can decrypt — on
// macOS each app.getName() gets its own "<name> Safe Storage" keychain
// entry. We must call `app.setName(product)` BEFORE app initializes
// safeStorage; that means before app.whenReady() resolves.
//
// The token is read from stdin so it never appears in process listings.
//
// Usage:
//   echo "<jwt>" | electron lib/write-auth-bin.mjs --product "Lightfast Dev"

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, safeStorage } from "electron";

function parseArgs() {
  const out = { product: null };
  const argv = process.argv.slice(2);
  const iter = argv[Symbol.iterator]();
  for (const arg of iter) {
    if (arg === "--product") {
      out.product = iter.next().value ?? null;
    }
  }
  return out;
}

const { product } = parseArgs();
if (!product) {
  console.error("[write-auth-bin] missing --product (e.g. 'Lightfast Dev')");
  app.exit(1);
}

// MUST happen before whenReady. The desktop's bootstrap.ts does the same.
app.setName(product);
app.setPath("userData", join(app.getPath("appData"), product));

function readTokenFromStdin() {
  let buf;
  try {
    buf = readFileSync(0, "utf8");
  } catch (err) {
    throw new Error(`failed to read token from stdin: ${err.message}`);
  }
  return buf.trim();
}

async function main() {
  // Hide the dock icon — we are headless.
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }

  await app.whenReady();

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "safeStorage encryption is not available. On macOS this usually means keychain access was denied."
    );
  }

  const token = readTokenFromStdin();
  if (!token) {
    throw new Error("token is empty");
  }

  // Schema mirrors apps/desktop/src/main/auth-store.ts:
  //   { token: string, savedAt: number }  → JSON → safeStorage.encryptString
  const payload = JSON.stringify({ token, savedAt: Date.now() });
  const cipher = safeStorage.encryptString(payload);

  const userData = app.getPath("userData");
  const outPath = join(userData, "auth.bin");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, cipher);

  process.stdout.write(`${outPath}\n`);
  app.exit(0);
}

main().catch((err) => {
  console.error("[write-auth-bin]", err.message);
  app.exit(1);
});
