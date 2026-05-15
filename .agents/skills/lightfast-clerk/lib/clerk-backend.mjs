#!/usr/bin/env node
// Tiny Clerk Backend API wrapper for the lightfast-clerk skill.
//
// Usage:
//   node clerk-backend.mjs ensure-user <email>                   → prints userId
//   node clerk-backend.mjs delete-user <userId>                  → exits 0 on success
//   node clerk-backend.mjs delete-user-by-email <email>          → exits 0 + prints deleted userId, 3 on 404
//   node clerk-backend.mjs get-user <userId>                     → exit 0 + JSON on found, 3 on 404
//   node clerk-backend.mjs find-user <email>                     → exit 0 + JSON on found, 3 on 404
//   node clerk-backend.mjs mint-session-token <userId> [template]
//   node clerk-backend.mjs create-sign-in-token <userId> [expires_in_seconds]   → JSON { id, token, url, status, ... } (NO expires_at — read it from the JWT 'exp' claim)
//   node clerk-backend.mjs create-invitation <email> [redirect_url] [--no-notify]→ JSON { id, url, expires_at, ... }
//   node clerk-backend.mjs find-invitation <id>                                  → JSON on found, exit 3 on 404
//   node clerk-backend.mjs revoke-invitation <id>                                → exits 0 on success
//
// Requires CLERK_SECRET_KEY (sk_test_...) in env. Refuses non-test keys.
//
// Conventions:
//   - exit 0 + stdout payload on success
//   - exit 3 + stderr note on "not found" (so callers can branch without parsing)
//   - exit 1 + stderr error on any other failure

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

// Mint a sign-in token (magic-link primitive). The token is the value the
// caller embeds in /sign-in?step=activate&token=<token>. Clerk does NOT send
// an email here — delivery is up to the caller (or rely on the real-email
// round-trip via the actual /sign-in form).
async function createSignInToken(userId, expiresInSeconds) {
  const body = { user_id: userId };
  if (expiresInSeconds !== undefined) {
    body.expires_in_seconds = expiresInSeconds;
  }
  return clerk("POST", "/sign_in_tokens", body);
}

// Create an invitation. Returns the invitation object including the magic
// link URL Clerk emails to the recipient. Defaults to notify=true (Clerk
// sends the email). Pass notify=false to suppress delivery (useful when
// you only want the URL for programmatic testing without filling the
// recipient's real inbox).
async function createInvitation(email, redirectUrl, { notify = true } = {}) {
  const body = { email_address: email, notify };
  if (redirectUrl) {
    body.redirect_url = redirectUrl;
  }
  return clerk("POST", "/invitations", body);
}

// Clerk does NOT expose GET /v1/invitations/<id> — that route 404s. Use the
// list endpoint with a query filter and match on id. Two quirks to handle:
//   1. The default list only returns status=pending. We pass all four
//      statuses explicitly so revoked/accepted/expired invitations are
//      also discoverable (the natural verification path after revoke is
//      "did the status flip?", which silently fails otherwise).
//   2. The query string matches across multiple fields (email, id, etc.),
//      so we filter the result list to be exact-id.
async function findInvitation(invitationId) {
  const params = new URLSearchParams({ query: invitationId, limit: "10" });
  for (const status of ["pending", "accepted", "revoked", "expired"]) {
    params.append("status", status);
  }
  const list = await clerk("GET", `/invitations?${params}`);
  if (!Array.isArray(list)) {
    return null;
  }
  return list.find((inv) => inv.id === invitationId) ?? null;
}

async function revokeInvitation(invitationId) {
  await clerk("POST", `/invitations/${invitationId}/revoke`, {});
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
    case "find-user": {
      const [email] = args;
      if (!email) {
        throw new Error("find-user requires <email>");
      }
      const user = await findUserByEmail(email);
      if (!user) {
        process.stderr.write(`[clerk-backend] no user for email ${email}\n`);
        process.exit(3);
      }
      process.stdout.write(JSON.stringify(user));
      break;
    }
    case "delete-user-by-email": {
      const [email] = args;
      if (!email) {
        throw new Error("delete-user-by-email requires <email>");
      }
      const user = await findUserByEmail(email);
      if (!user) {
        process.stderr.write(`[clerk-backend] no user for email ${email}\n`);
        process.exit(3);
      }
      await deleteUser(user.id);
      process.stdout.write(user.id);
      break;
    }
    case "create-sign-in-token": {
      const [userId, expiresArg] = args;
      if (!userId) {
        throw new Error(
          "create-sign-in-token requires <userId> [expires_in_seconds]"
        );
      }
      const expiresInSeconds =
        expiresArg === undefined ? undefined : Number(expiresArg);
      if (expiresInSeconds !== undefined && Number.isNaN(expiresInSeconds)) {
        throw new Error(`invalid expires_in_seconds: ${expiresArg}`);
      }
      const token = await createSignInToken(userId, expiresInSeconds);
      process.stdout.write(JSON.stringify(token));
      break;
    }
    case "create-invitation": {
      // Strip --no-notify wherever it appears in args; remaining positionals
      // are <email> [redirect_url]. Keeping the flag flag-shaped (rather than
      // a 3rd positional) avoids ambiguity with optional redirect_url.
      const noNotify = args.includes("--no-notify");
      const positional = args.filter((a) => a !== "--no-notify");
      const [email, redirectUrl] = positional;
      if (!email) {
        throw new Error(
          "create-invitation requires <email> [redirect_url] [--no-notify]"
        );
      }
      const invitation = await createInvitation(email, redirectUrl, {
        notify: !noNotify,
      });
      process.stdout.write(JSON.stringify(invitation));
      break;
    }
    case "find-invitation": {
      const [invitationId] = args;
      if (!invitationId) {
        throw new Error("find-invitation requires <invitation_id>");
      }
      const invitation = await findInvitation(invitationId);
      if (!invitation) {
        process.stderr.write(
          `[clerk-backend] invitation ${invitationId} not found\n`
        );
        process.exit(3);
      }
      process.stdout.write(JSON.stringify(invitation));
      break;
    }
    case "revoke-invitation": {
      const [invitationId] = args;
      if (!invitationId) {
        throw new Error("revoke-invitation requires <invitation_id>");
      }
      await revokeInvitation(invitationId);
      break;
    }
    default:
      console.error(`unknown subcommand: ${subcommand}`);
      console.error(
        `usage: ${process.argv[1]} <ensure-user|delete-user|delete-user-by-email|get-user|find-user|mint-session-token|create-sign-in-token|create-invitation|find-invitation|revoke-invitation> ...`
      );
      process.exit(2);
  }
} catch (err) {
  console.error(`[clerk-backend] ${err.message}`);
  process.exit(1);
}
