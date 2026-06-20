# @vendor/email

A small boundary around the Resend SDK.

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
import { createEmailClient } from "@vendor/email";

const email = createEmailClient(process.env.RESEND_API_KEY);

await email.emails.send({
  from: "Lightfast <hello@lightfast.ai>",
  to: "recipient@example.com",
  subject: "Hello from Lightfast",
  text: "This is a test email.",
});
```

## API

### `createEmailClient(apiKey)`

Creates a Resend client. Application packages should import this boundary
instead of importing `resend` directly.
