# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

As Lightfast is in active development, use the latest published versions of
the public CLI, SDK, and MCP packages for current security fixes.

## Reporting a Vulnerability

We take security vulnerabilities seriously. Do not create a public GitHub issue
for a suspected vulnerability.

Email security@lightfast.ai with:

- A description of the vulnerability
- Steps to reproduce it
- Its likely impact
- Any proposed fixes or mitigations
- Contact information for follow-up

You can expect:

- Acknowledgment within 48 hours
- An initial assessment within five business days
- Progress updates during the investigation
- Coordinated disclosure for confirmed issues
- Credit in security advisories, with your permission

Target response times are one to three business days for critical issues, one
week for high-severity issues, and the next regular release cycle for medium-
or low-severity issues.

## Repository Security Boundaries

- Public clients require explicit endpoint configuration; this repository does
  not provide an implicit hosted Lightfast backend.
- `apps/desktop` is a sandboxed static local shell with no Node.js renderer
  integration, remote navigation, updates, signing, or distribution wiring.
- `apps/mcp` is a local stdio-only shell with no HTTP listener, authentication,
  secret, deployment, or hosted endpoint.
- Database clients require explicit credentials and do not connect at import
  time. Provider access and schema writes require separate approval.
- Never commit credentials or copy package-local environment values between
  workspaces.

Dependency review, CodeQL, repository checks, and focused package tests run in
CI. These controls supplement, rather than replace, review of trust boundaries
and user-controlled inputs.

## Security Best Practices

### For Contributors

- Validate user-controlled inputs at trust boundaries.
- Never expose sensitive data in client-side code or error messages.
- Keep dependencies current and review security advisories.
- Use HTTPS for configured remote endpoints.
- Preserve explicit endpoint configuration; do not add implicit hosted
  Lightfast defaults.
- Keep provider access and environment values package-local.

### For Users

- Keep public Lightfast packages up to date.
- Secure API keys and other environment variables.
- Apply appropriate access controls at the configured compatible backend.
- Monitor applications for unusual activity and back up important
  configuration.

## Vulnerability Management

Repository maintainers use dependency review, automated security scanning,
security-focused code review, and focused architectural review. Critical
components may also receive targeted audits or penetration testing.

## Contact

- Security issues: security@lightfast.ai
- General security questions: open a GitHub discussion with the `security`
  label, without including vulnerability details

## Acknowledgments

We appreciate the security research community and acknowledge researchers who
responsibly disclose vulnerabilities, with their permission.

---

This policy evolves with the project. Check back for current guidance.
