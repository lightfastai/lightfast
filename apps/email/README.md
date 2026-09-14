# @lightfast/email

Local React Email workbench and owner of Lightfast email templates.
Templates live in `src/templates` and share app-local components in
`src/components`; brand assets and the email button come from `@repo/ui`.
This app previews, exports, builds, and typechecks templates. It has no email
sending or production integration.

```bash
pnpm --filter @lightfast/email dev
pnpm --filter @lightfast/email export
pnpm --filter @lightfast/email build
pnpm --filter @lightfast/email typecheck
```

The preview server runs on `http://localhost:3005`.
Export writes plain-text templates to `out`; build writes the preview app to
`.react-email`. Both use the templates' existing `PreviewProps` fixtures.
