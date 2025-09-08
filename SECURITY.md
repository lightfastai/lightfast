# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

As Lightfast is in active development, we recommend always using the latest version for the most up-to-date security features.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in Lightfast, please report it responsibly.

### How to Report

**Please do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please:

1. **Email us directly** at security@lightfast.ai
2. **Include the following information:**
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Any suggested fixes or mitigations
   - Your contact information for follow-up

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We'll provide an initial assessment within 5 business days
- **Updates**: We'll keep you informed of our progress throughout the investigation
- **Resolution**: We'll work to resolve confirmed vulnerabilities as quickly as possible
- **Credit**: With your permission, we'll acknowledge your contribution in our security advisories

### Response Timeline

- **Critical vulnerabilities**: Patched within 1-3 business days
- **High severity**: Patched within 1 week
- **Medium/Low severity**: Patched in the next regular release cycle

## Security Best Practices

### For Contributors

- **Input Validation**: Always validate and sanitize user inputs using Zod schemas
- **Authentication**: Use proper authentication mechanisms (Clerk integration)
- **Rate Limiting**: Implement rate limiting using Arcjet for API endpoints
- **Environment Variables**: Never expose sensitive data in client-side code
- **Dependencies**: Keep dependencies up to date and review security advisories
- **HTTPS**: Always use HTTPS in production environments
- **Error Handling**: Don't expose sensitive information in error messages

### For Users

- **Keep Updated**: Always use the latest version of Lightfast
- **Environment Variables**: Secure your environment variables and API keys
- **Access Control**: Implement proper access controls for your applications
- **Monitoring**: Monitor your applications for unusual activity
- **Backup**: Regularly backup your data and configurations

## Security Features

### Built-in Security

- **Input Validation**: Comprehensive validation using Zod schemas
- **Rate Limiting**: Built-in rate limiting via Arcjet integration
- **Request Signing**: Request ID tracking for audit trails
- **CSRF Protection**: Cross-site request forgery protection
- **Secure Headers**: Security headers configured by default
- **Error Handling**: Secure error handling that doesn't leak sensitive information

### Cloud Security

- **Resource Sandboxing**: Isolated execution environments
- **Secure API Endpoints**: All API endpoints follow security best practices
- **Encrypted Communication**: End-to-end encryption for sensitive operations
- **Audit Logging**: Comprehensive audit trails for security monitoring

## Vulnerability Management

### Internal Security Practices

- Regular security audits of dependencies
- Automated security scanning in CI/CD pipeline
- Code reviews with security focus
- Penetration testing for critical components
- Security-focused architectural decisions

### Third-Party Security

We rely on security best practices from our dependencies:
- **Next.js**: Following Next.js security guidelines
- **Clerk**: Enterprise-grade authentication
- **Vercel**: Secure hosting and deployment
- **Arcjet**: Real-time security protection

## Security Resources

### Documentation

- [Next.js Security Guidelines](https://nextjs.org/docs/advanced-features/security-headers)
- [Clerk Security Best Practices](https://clerk.com/docs/security)
- [Vercel Security](https://vercel.com/docs/concepts/edge-network/security)

### Tools and Dependencies

- **Zod**: Runtime type validation and schema validation
- **Arcjet**: Rate limiting and security protection
- **Clerk**: Authentication and user management
- **Sentry**: Error tracking and monitoring
- **ESLint Security Plugin**: Static code analysis for security issues

## Contact

For security-related questions or concerns:
- **Security Issues**: security@lightfast.ai
- **General Security Questions**: Create a GitHub discussion with the "security" label

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who responsibly disclose vulnerabilities to us.

---

**Note**: This security policy is subject to updates as the project evolves. Please check back regularly for the latest security guidelines and procedures.