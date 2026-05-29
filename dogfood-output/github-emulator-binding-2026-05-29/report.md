# Dogfood Report: GitHub Emulator Binding Flow

| Field | Value |
|-------|-------|
| **Date** | 2026-05-29 |
| **App URL** | https://lightfast.localhost |
| **Session** | github-emulator-binding-2026-05-29 |
| **Scope** | GitHub org binding flow through the local GitHub emulator |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Issues

No issues recorded yet.

## Run Notes

- Signed in with Clerk test-mode user `debug-github-emulator-binding+clerk_test@lightfast.ai`.
- Created Lightfast team `githubemulatore2e`.
- First GitHub callback returned `github_error=installation_already_bound` because local dev DB already had emulator installation `1001` actively bound to an older test org.
- Reset only the stale local emulator fixture ownership by revoking that previous binding row and clearing its installation id.
- Retried the flow successfully: `/githubemulatore2e/tasks/bind` -> local emulator OAuth -> `/githubemulatore2e/tasks/bind/github/complete` -> `/githubemulatore2e`.
- Verified DB row is active for current org with provider `github`, provider account login `lightfast-emulated`, provider installation id `1001`.

## Evidence

- Video: `videos/full-binding-flow.webm`
- Key screenshots:
  - `screenshots/07-bind-task-page.png`
  - `screenshots/09-emulator-oauth-user-select.png`
  - `screenshots/13-after-second-emulator-user-select.png`
  - `screenshots/14-final-workspace-or-complete.png`
