#!/usr/bin/env node
// Tiny Clerk Backend API wrapper for the lightfast-clerk skill.
//
// Usage:
//   node clerk-backend.mjs ensure-user <email>           → prints userId
//   node clerk-backend.mjs delete-user <userId>          → exits 0 on success
//   node clerk-backend.mjs get-user <userId>             → exit 0 + JSON on found, 3 on 404
//   node clerk-backend.mjs mint-session-token <userId> [template]
//
// Requires CLERK_SECRET_KEY (sk_test_...) in env. Refuses non-test keys.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const ENV_FILE = resolve(REPO_ROOT, "apps/app/.vercel/.env.development.local");
const CLERK_API = "https://api.clerk.com/v1";

function loadSecretKey() {
  if (process.env.CLERK_SECRET_KEY) {
    return process.env.CLERK_SECRET_KEY;
  }
  const text = readFileSync(ENV_FILE, "utf8");
  const m = text.match(/^CLERK_SECRET_KEY="?([^"\n]+)"?$/m);
  if (!m) {
    throw new Error(`CLERK_SECRET_KEY not found in ${ENV_FILE}`);
  }
  return m[1];
}

const SECRET = loadSecretKey();
if (!SECRET.startsWith("sk_test_")) {
  console.error(
    `[clerk-backend] refusing non-test key (starts with ${SECRET.slice(0, 8)}). Dev-only.`
  );
  process.exit(1);
}

async function clerk(method, path, body) {
  const res = await fetch(`${CLERK_API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — the res.ok branch below rethrows with the raw text.
  }
  if (!res.ok) {
    const detail =
      json?.errors?.[0]?.long_message ?? json?.errors?.[0]?.message ?? text;
    throw new Error(`Clerk ${method} ${path} → ${res.status}: ${detail}`);
  }
  return json;
}

async function findUserByEmail(email) {
  // Clerk's filter uses `email_address` (repeatable, comma-separated)
  const params = new URLSearchParams({ email_address: email, limit: "1" });
  const list = await clerk("GET", `/users?${params}`);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

async function ensureUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) {
    return existing.id;
  }
  const created = await clerk("POST", "/users", {
    email_address: [email],
    skip_password_requirement: true,
    // Lightfast has legal_consent_enabled in Clerk dashboard.
    // Backend creation must record consent explicitly.
    legal_accepted_at: new Date().toISOString(),
  });
  return created.id;
}

async function deleteUser(userId) {
  await clerk("DELETE", `/users/${userId}`);
}

// Returns the user object on 200, null on 404, throws on other errors.
// Distinct exit code (3) lets `status.sh` react to "ghost" meta (userId in
// meta.json but the Clerk user is gone) without tangling with generic errors.
async function getUser(userId) {
  const res = await fetch(`${CLERK_API}/users/${userId}`, {
    method: "GET",
    headers: { authorization: `Bearer ${SECRET}` },
  });
  if (res.status === 404) {
    return null;
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — the res.ok branch below rethrows with the raw text.
  }
  if (!res.ok) {
    const detail =
      json?.errors?.[0]?.long_message ?? json?.errors?.[0]?.message ?? text;
    throw new Error(`Clerk GET /users/${userId} → ${res.status}: ${detail}`);
  }
  return json;
}

async function mintSessionToken(userId, template) {
  // Create a session for the user
  const session = await clerk("POST", "/sessions", { user_id: userId });
  // Mint a token. With template path, /tokens/{template}; default template is /tokens
  const path = template
    ? `/sessions/${session.id}/tokens/${encodeURIComponent(template)}`
    : `/sessions/${session.id}/tokens`;
  const res = await clerk("POST", path, {});
  return res.jwt;
}

const [, , subcommand, ...args] = process.argv;

try {
  switch (subcommand) {
    case "ensure-user": {
      const [email] = args;
      if (!email) {
        throw new Error("ensure-user requires <email>");
      }
      const id = await ensureUser(email);
      process.stdout.write(id);
      break;
    }
    case "delete-user": {
      const [userId] = args;
      if (!userId) {
        throw new Error("delete-user requires <userId>");
      }
      await deleteUser(userId);
      break;
    }
    case "get-user": {
      const [userId] = args;
      if (!userId) {
        throw new Error("get-user requires <userId>");
      }
      const user = await getUser(userId);
      if (user === null) {
        process.stderr.write(
          `[clerk-backend] user ${userId} not found (404)\n`
        );
        process.exit(3);
      }
      process.stdout.write(JSON.stringify(user));
      break;
    }
    case "mint-session-token": {
      const [userId, template] = args;
      if (!userId) {
        throw new Error("mint-session-token requires <userId> [template]");
      }
      const jwt = await mintSessionToken(userId, template);
      process.stdout.write(jwt);
      break;
    }
    default:
      console.error(`unknown subcommand: ${subcommand}`);
      console.error(
        `usage: ${process.argv[1]} <ensure-user|delete-user|mint-session-token> ...`
      );
      process.exit(2);
  }
} catch (err) {
  console.error(`[clerk-backend] ${err.message}`);
  process.exit(1);
}
