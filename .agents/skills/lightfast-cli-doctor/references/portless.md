# `portless` — doctor playbook

Third-party CLI from https://portless.sh — replaces port numbers with stable
`*.localhost` URLs over HTTPS on port 443. Maintained by Vercel.

## Probe (read-only)

- **Installed**: `command -v portless` → green when exit 0.
- **Version**: `portless --version` → green when ≥ `0.12.0` (verified on the known-good host as of 2026-05-14, latest 0.13.0).
- **CA cert present**: `test -f ~/.portless/ca.pem && test -s ~/.portless/ca.pem` → green when the file exists and is non-empty. This is the load-bearing artifact — `NODE_EXTRA_CA_CERTS` and browser TLS both depend on it.
- **Proxy daemon (informational, not a fix trigger)**: `portless proxy status` → reports whether the HTTPS proxy on :443 is running. The doctor does NOT require the daemon to be up; `portless` starts it on first use.

## Install (only when "installed" probe fails)

```
npm i -g portless@latest
```

The Portless installer recommends global install over project-dev. After
install, re-run the *installed* probe.

## Cert init (only when "CA cert present" probe fails)

```
portless trust
```

Generates a local root CA at `~/.portless/ca.pem` and adds it to the OS trust
store (macOS Keychain / Linux NSS). Re-run the **CA cert present** probe.

If `portless trust` errors with "already trusted" but `~/.portless/ca.pem` still
doesn't exist, the CA index is stale:

```
portless clean
portless trust
```

## Set org / project

N/A — portless has no auth dimension, no org membership.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

```
npm i -g portless@latest
```

The same command upgrades in place. After upgrade, re-run the *version* probe.

## Known gotchas

- **macOS-first.** On Linux, `portless trust` may require root or `sudo`
  depending on the trust store (NSS / `update-ca-certificates`). The doctor
  does not currently encode Linux-specific recovery.
- **Port 443 is privileged.** `portless proxy start` requires the OS to grant
  the binary `cap_net_bind_service` (Linux) or run with elevated privileges
  (macOS uses launchd). On first run portless prompts for the privilege grant;
  the doctor does not pre-empt this.
- **Stale CA after major-version bump.** Between Portless majors the CA format
  has changed; `portless clean` + `portless trust` is the documented reset.
  The "already trusted" error masks this case.
- **CA cert location is canonical, not configurable.** Always `~/.portless/ca.pem`.
  Do not probe alternative paths.
- **Browsers cache the CA aggressively.** After `portless trust`, Safari and
  Chrome may need a restart to pick up the new root. Firefox uses its own
  trust store entirely and requires manual import. The doctor does not drive
  the browser side.
