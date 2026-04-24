# Sign-in / sign-out playbook

A goal-driven recipe for driving `agent-browser` through Lightfast's Clerk auth
UI. **The driving agent executes the commands** (Claude, a test script, a
human) — this skill provides the contract and waypoints, not the selectors.

Why not a script: the sign-in UI changes more often than Clerk's API contract.
A hardcoded script lies by omission when the UI drifts (form fills, nothing
errors, but the wrong thing happened). An agent driving this playbook
*observes* the page and reports what it saw, which is exactly the signal a
debug workflow needs.

## When to use this vs. alternatives

- **Need a JWT to call tRPC?** Skip this entirely. Use `command/token.sh`.
  No browser involved.
- **Need a live Clerk cookie in a profile** (desktop app renderer, UI flow
  testing)? → run this playbook once per profile. Cookies persist; subsequent
  uses of the profile skip sign-in.
- **Testing the sign-in flow itself?** Reset the profile first, then run the
  playbook. Variations from the waypoints below *are the diagnostic signal*
  you're looking for.

## Preconditions (do these before touching a browser)

1. **Ensure the Clerk user exists.** Sign-ups are waitlist-gated, so backend
   provisioning is mandatory:
   ```bash
   node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs ensure-user \
     "debug-<slug>+clerk_test@lightfast.ai"
   # → prints userId
   ```
   Write the userId and email into `.agent-browser/profiles/<profile>.meta.json`.
   `command/token.sh <profile>` already does this if you haven't yet.

2. **Dev server reachable.** `curl -sS -o /dev/null -w '%{http_code}\n'
   http://localhost:3024/sign-in` should return `200`. If it doesn't, fix that
   before driving a browser — otherwise every waypoint failure is
   indistinguishable from "server isn't up."

3. **Safety-gated key.** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must start with
   `pk_test_`. `lib/common.sh assert_safe_env` enforces this, but nothing in
   this playbook calls it — the driving agent is responsible for not running
   this against a production Clerk tenant.

## Invariants (these are stable; trust them)

- Email **must** match `<anything>+clerk_test@<anything>` — that's what
  triggers Clerk test mode.
- OTP code is **always** `424242` in test mode. Never changes.
- Success means: final URL does not contain `/sign-in`.
- `window.Clerk.user.id` after success equals the userId you provisioned.

If any of those four things breaks, the problem is not the UI — it's either
the Clerk tenant config or the auth backend. Escalate, don't retry.

## Sign-in waypoints

Each waypoint has a **goal** (what you want to be true) and a **how** (the
most robust way to verify or advance). Use `snapshot` between waypoints if
anything looks off — it returns the accessibility tree with refs and is the
cheapest way for an agent to orient.

### Waypoint 0 — Bind the browser to a profile

```bash
agent-browser --profile .agent-browser/profiles/<profile> \
              --session lightfast-clerk-<profile> \
              open http://localhost:3024/sign-in
```

Reuse the `--profile` and `--session` flags on every subsequent call for this
profile. The first call starts a daemon; later calls reuse it.

### Waypoint 1 — Detect if already signed in

**Goal:** final URL does not contain `/sign-in`.

```bash
agent-browser ... get url
```

If the URL changed away from `/sign-in` (usually to `/account/welcome`,
`/account`, or similar), skip to waypoint 5. Clerk has redirected an already-
authed user off the sign-in page.

If the URL is still `/sign-in` after ~1s, proceed to waypoint 2.

### Waypoint 2 — Fill email and submit

**Goal:** the page transitions from "enter email" to "enter OTP."

Idiom: **snapshot first, then use `@ref` with primitives.** The snapshot
returns an accessibility tree with refs like `[ref=e6]`. Refs are stable
within a page but **renumber when the page navigates**, so always snapshot
again between waypoints.

```bash
agent-browser ... snapshot
# Look for something like:
#   textbox "Email Address" [required, ref=e6]
#   button "Continue with Email" [ref=e7]
agent-browser ... fill "@e6" "<email>"
agent-browser ... click "@e7"
```

Alternative locators (`find role button --name "Continue with Email"` etc.)
exist in agent-browser's help but the ref idiom is the one designed for AI
agents: snapshot is the discovery primitive, refs are its output. Use it.

If no email textbox or submit button appears in the snapshot, the UI has
drifted — report what the snapshot showed and what was missing.

### Waypoint 3 — Enter OTP

**Goal:** URL leaves `/sign-in`.

```bash
agent-browser ... snapshot
# Should now show a "Verification" heading and a single textbox (OTP input).
# Example:
#   heading "Verification" [level=1]
#   textbox [ref=e7]
agent-browser ... fill "@e7" "424242"
```

OTP auto-submits at 6 digits. Poll URL until it leaves `/sign-in` or ~30s
elapses:

```bash
for _ in $(seq 1 30); do
  url=$(agent-browser ... get url)
  [[ "$url" != *"/sign-in"* ]] && break
  sleep 1
done
```

Empirically (as of 2026-04-23) the redirect happens in ~2s — longer suggests
OTP verification failed silently. Escalate to waypoint 4.

### Waypoint 4 — Diagnose failure (if URL did not change)

If after 30s the URL is still `/sign-in`, **do not retry blindly**. Gather
signal:

```bash
agent-browser ... snapshot               # what's on screen?
agent-browser ... console                # client-side errors?
agent-browser ... errors                 # page errors?
agent-browser ... screenshot /tmp/signin-fail.png
```

Common diagnoses:

| Observation | Likely cause |
|---|---|
| Error text "Enter the correct verification code" | OTP field submitted something other than `424242` — check fill target |
| Error text mentioning waitlist | Backend `ensure-user` wasn't run, user hit waitlist gate |
| Form looks different (new fields, consent checkbox) | UI drifted — describe what's new and surface for human review |
| No visible error, URL stuck | Clerk JS failed to load — check `console` output |

### Waypoint 5 — Confirm Clerk client state and write meta

**Goal:** `window.Clerk.user.id` matches the provisioned userId.

```bash
# Wait for Clerk JS to settle (up to ~10s)
for _ in $(seq 1 20); do
  loaded=$(agent-browser ... eval "typeof window.Clerk !== 'undefined' && window.Clerk.loaded && !!window.Clerk.user")
  [[ "$loaded" == "true" ]] && break
  sleep 0.5
done

USER_ID=$(agent-browser ... eval "window.Clerk?.user?.id ?? ''" | tr -d '"')
```

If `USER_ID` doesn't equal the userId you provisioned, something is wrong
(wrong user signed in — fresh cookie from another session, email collision).
Stop and surface.

If it matches, update the meta sidecar. **This step is mandatory** — without
it, a subsequent `token.sh` call will refuse with "profile has a browser dir
but no meta" (guard against silent cross-contamination):

```bash
# meta_write lives in lib/common.sh. The helpers are bash-only — if you're
# in zsh, wrap with `bash -c`.
bash -c '
  cd /path/to/repo
  source .agents/skills/lightfast-clerk/lib/common.sh
  meta_write <profile> "{ email: \"<email>\", userId: \"$USER_ID\", signedInAt: new Date().toISOString() }"
'
```

Close the browser session (optional — the daemon persists):

```bash
agent-browser ... close
```

## Sign-out waypoints

Much simpler. Three steps.

### Step 1 — Land on an authed page

```bash
agent-browser ... open http://localhost:3024/sign-in
# Clerk redirects authed users away from /sign-in, so landing anywhere else
# means the session is live.
url=$(agent-browser ... get url)
if [[ "$url" == *"/sign-in"* ]]; then
  # Already signed out.
  exit 0
fi
```

### Step 2 — Invoke sign-out

Preferred: call Clerk JS directly (stable API contract):

```bash
agent-browser ... eval "(async () => { await window.Clerk.signOut(); })()"
```

Alternative (if the UI has a visible sign-out button and you're testing it):

```bash
agent-browser ... find role button click "Sign out"
# Or: find text "Sign out" — depends on UI
```

### Step 3 — Verify

```bash
agent-browser ... open http://localhost:3024/sign-in
url=$(agent-browser ... get url)
[[ "$url" == *"/sign-in"* ]] || echo "WARN: signout reported success but url=$url"
```

Note: sign-out does **not** wipe the profile dir or the meta sidecar. Cookies
in the profile are invalidated server-side but local files remain. For a full
local wipe, use `command/reset.sh`. For server-side deletion of the Clerk
user, use `command/delete-user.sh`.

## Reporting results back

The driving agent is responsible for reporting back to whoever invoked it:

- **Success:** `signed in as <userId>, signedInAt=<iso>, profile=<name>`
- **Benign failure (already signed in):** `already signed in as <userId>`
- **UI drift:** what waypoint you were at, what you expected vs. saw, include
  a snapshot or screenshot path
- **Hard failure:** which waypoint, what the console/errors showed

That narrative is the point — it's what separates "the flow is broken" from
"the skill is broken" from "the tenant is misconfigured."
