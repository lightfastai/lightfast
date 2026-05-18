# `auth.bin` on-disk format

The contract this skill writes against. If
`apps/desktop/src/main/auth-store.ts` changes, this file is the diff
target.

## Path (dev mode, macOS)

```
~/Library/Application Support/Lightfast Dev/auth.bin
```

`Lightfast Dev` is set in `apps/desktop/src/main/bootstrap.ts`:

```ts
const productName = app.isPackaged ? "Lightfast" : "Lightfast Dev";
app.setName(productName);
app.setPath("userData", join(app.getPath("appData"), productName));
```

In a packaged build, the directory is `Lightfast` (no " Dev" suffix).
This skill is dev-only, so it always uses `Lightfast Dev`. To override
(don't), set `LIGHTFAST_DSI_PRODUCT=...`.

## Format

`auth.bin` is the raw output of Electron's `safeStorage.encryptString`
applied to a JSON payload of:

```json
{ "token": "<clerk-jwt>", "savedAt": <unix-ms> }
```

Schema (from `auth-store.ts`):

```ts
const persistedSchema = z.object({
  token: z.string().min(1),
  savedAt: z.number().int().positive(),
});
```

## Encryption — why Electron and not plain Node

`safeStorage` ciphertext is bound to the OS user account's keychain
entry for Electron (macOS Keychain Access shows it under "Electron Safe
Storage" or, on signed builds, the specific app's bundle id). Plain
Node has no access to that key.

So writing `auth.bin` requires running Electron itself. This skill
ships a tiny headless helper (`lib/write-auth-bin.mjs`) that:

1. Hides the dock icon (`app.dock.hide()` — macOS only).
2. Waits for `app.whenReady()`.
3. Sets `app.setName(productName)` and `app.setPath("userData", ...)`
   — the same two calls the real app's `bootstrap.ts` makes — so
   `safeStorage` writes to the same Keychain entry the desktop will
   later read.
4. Encrypts the JSON payload and writes the ciphertext.
5. Exits with code 0.

The JWT is read from stdin, never from `process.argv`, so it can't
leak via process listings.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `safeStorage encryption is not available` from helper | macOS prompted for keychain access and you denied | Re-run; allow the prompt |
| Desktop boots but stays on `SignedOutShell` | `auth.bin` exists but path mismatch (e.g. wrong `productName`) | Verify `bootstrap.ts` still uses `Lightfast Dev` for unpackaged builds |
| Desktop boots signed in but `account.get` returns 401 | JWT expired (template TTL is 1h) or wrong template | Re-run `sign-in.sh` to mint a fresh token |
| Desktop boots signed in but tRPC errors with `org_id` missing | JWT was minted without the `lightfast-desktop` template | `sign-in.sh` always passes the template; if you bypassed it, mint with `lightfast-clerk/command/token.sh <profile> lightfast-desktop` |

## Re-deriving the format if `auth-store.ts` changes

1. Diff `auth-store.ts` for changes to `persistedSchema`.
2. Update the JSON payload in `lib/write-auth-bin.mjs` to match.
3. Update the `Format` section above.
4. Re-run `sign-in.sh` and confirm the desktop boots signed in.

That's the entire contract — three pieces (path, schema, encryption
context). Keep it simple.
