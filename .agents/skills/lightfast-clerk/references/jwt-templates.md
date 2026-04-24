# JWT templates

Clerk lets you mint custom JWTs from the same session via [JWT templates](https://clerk.com/docs/backend-requests/making/jwt-templates).
This skill supports passing a template name to `token.sh` / `curl.sh`.

## Templates Lightfast uses

### `lightfast-desktop`

For the Electron desktop app (Phase 4-7 of `2026-04-23-desktop-clerk-trpc-wiring.md`).

- **Expiry**: `3600` seconds (1 hour)
- **Claims**: `{ "org_id": "{{org.id}}" }` (default Clerk claim — null if user has no active org)
- **Signing**: default (HS256, verifies via `CLERK_SECRET_KEY`)

This template **must be created manually in the Clerk Dashboard once per
environment** (dev, prod). The skill cannot create templates programmatically.

### Default (no template)

`token.sh <profile>` (no second arg) mints a standard Clerk session JWT:
- Short-lived (~60s by default)
- Same claims as the session cookie

Useful for testing what the web app sees from cookie-auth requests.

## Behavior gotcha

Default-template JWTs (no `org_id` claim) cause the Lightfast middleware to
treat the request as `pending` and 307-redirect to `/account/welcome` — even
though `resolveClerkSession` would have accepted the JWT at the route level.

This is `proxy.ts` running auth() and finding `sessionStatus === "pending"`,
which is independent of Bearer-vs-cookie. Use `lightfast-desktop` for tRPC
calls — it explicitly carries `org_id` and bypasses the redirect.

```bash
# Will 307 to /account/welcome:
.agents/skills/lightfast-clerk/command/curl.sh claude-default account.get

# Will return 200:
.agents/skills/lightfast-clerk/command/curl.sh -t lightfast-desktop claude-default account.get
```

## Adding a new template

1. Clerk Dashboard → JWT Templates → New
2. Name it (e.g., `lightfast-cli`)
3. Set expiry + claims
4. Document it here

Then call: `token.sh <profile> lightfast-cli` or `curl.sh -t lightfast-cli ...`
