# @vendor/resend

A small boundary around the Resend SDK.

## Installation

This package is installed as a workspace dependency. Make sure your project's `package.json` includes:

```json
{
  "dependencies": {
    "@vendor/resend": "workspace:*"
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
import { createResendClient } from "@vendor/resend";

const resend = createResendClient(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "Lightfast <hello@lightfast.ai>",
  to: "recipient@example.com",
  subject: "Hello from Lightfast",
  text: "This is a test email.",
});
```

## API

### `createResendClient(apiKey)`

Creates a Resend client. Application packages should import this boundary
instead of importing `resend` directly.
