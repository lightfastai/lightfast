# @vendor/email

A type-safe wrapper around the email service for React TD.

## Installation

This package is installed as a workspace dependency. Make sure your project's `package.json` includes:

```json
{
  "dependencies": {
    "@vendor/email": "workspace:*"
  }
}
```

## Configuration

Add the following environment variable to your `.env` file:

```bash
RESEND_API_KEY=your_resend_api_key_here
```

## Usage

```typescript
import { sendEmail } from "@vendor/email";

// Send a simple email
await sendEmail({
  from: "you@example.com",
  to: "recipient@example.com",
  subject: "Hello from React TD",
  text: "This is a test email.",
});

// Send an HTML email with CC and BCC
await sendEmail({
  from: "you@example.com",
  to: ["recipient1@example.com", "recipient2@example.com"],
  subject: "Hello from React TD",
  html: "<h1>Hello!</h1><p>This is a test email.</p>",
  cc: "cc@example.com",
  bcc: ["bcc1@example.com", "bcc2@example.com"],
  replyTo: "reply@example.com",
});
```

## API

### `sendEmail(options: EmailOptions)`

Sends an email using the Resend service.

#### Options

- `from`: Sender email address
- `to`: Recipient email address(es)
- `subject`: Email subject
- `html`: HTML content (optional)
- `text`: Plain text content (optional)
- `cc`: CC recipient(s) (optional)
- `bcc`: BCC recipient(s) (optional)
- `replyTo`: Reply-to email address (optional)

#### Returns

```typescript
{
  success: boolean;
  data?: ResendResponse;
  error?: Error;
}
```
