# `auth.bin` session store

Reference for the desktop native-auth session file. If
`apps/desktop/src/main/native-auth/store.ts` changes, update this file.

## Path

Dev builds use the `Lightfast Dev` product name:

```text
~/Library/Application Support/Lightfast Dev/auth.bin
```

Packaged builds use:

```text
~/Library/Application Support/Lightfast/auth.bin
```

`apps/desktop/src/main/bootstrap.ts` sets this split before app readiness:

```ts
const productName = app.isPackaged ? "Lightfast" : "Lightfast Dev";
app.setName(productName);
app.setPath("userData", join(app.getPath("appData"), productName));
```

## Format

`auth.bin` is the raw output of Electron `safeStorage.encryptString` applied
to a JSON `NativeSession` payload. The current schema is defined by
`desktopNativeSessionSchema`:

```ts
{
  appUrl: string;
  client: "desktop";
  oauth: {
    clientId: string;
    issuer: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  schemaVersion: 2;
  tokens: {
    accessToken: string;
    expiresAt: number;
    refreshToken: string;
    tokenType: "Bearer";
  };
  user: {
    email: string | null;
    id: string;
  };
}
```

The app purges invalid or pre-migration payloads on read. Token-only payloads
such as `{ "token": "...", "savedAt": 123 }` are no longer valid.

## Debugging

Use `command/status.sh` to check whether the dev session file exists. It does
not decrypt the file. Use `command/sign-out.sh` to remove the dev session file
before the next launch.

The only supported sign-in path is the loopback OAuth flow in `SKILL.md`.
Writing `auth.bin` directly bypasses org binding, token refresh metadata, and
schema validation.
