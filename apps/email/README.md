# @lightfast/email

React Email workbench for Lightfast email templates.

Production code should import templates from `@repo/email`.
This app only runs the React Email preview and export tooling against
`packages/email/src/templates`.

```bash
pnpm --filter @lightfast/email dev
```

The preview server runs on `http://localhost:3005`.
