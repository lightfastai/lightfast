import { Effect, Layer } from "@effect/io";
import * as Schema from "@effect/schema/Schema";
import { Resend } from "resend";

// Schema for email configuration
export const EmailConfigSchema = Schema.struct({
  apiKey: Schema.string,
});

export type EmailConfig = Schema.To<typeof EmailConfigSchema>;

// Schema for email data
export const EmailDataSchema = Schema.struct({
  from: Schema.string,
  to: Schema.string,
  subject: Schema.string,
  text: Schema.optional(Schema.string),
  html: Schema.optional(Schema.string),
});

export type EmailData = Schema.To<typeof EmailDataSchema>;

// Email service interface
export interface EmailService {
  readonly send: (data: EmailData) => Effect.Effect<never, Error, void>;
}

// Email service implementation
export class ResendEmailService implements EmailService {
  private readonly client: Resend;

  constructor(config: EmailConfig) {
    this.client = new Resend(config.apiKey);
  }

  send(data: EmailData): Effect.Effect<never, Error, void> {
    return Effect.tryPromise({
      try: () => this.client.emails.send(data),
      catch: (error) => new Error(`Failed to send email: ${String(error)}`),
    }).pipe(Effect.map(() => undefined));
  }
}

// Email service tag
export const EmailService = {
  tag: Symbol.for("@repo/lib/email/EmailService"),
} as const;

// Email service layer
export const makeEmailLayer = (config: EmailConfig) =>
  Layer.succeed(
    EmailService.tag,
    new ResendEmailService(config) satisfies EmailService,
  );

// Email service live
export const EmailServiceLive = makeEmailLayer({
  apiKey: process.env.RESEND_API_KEY ?? "",
});

// Helper functions
export const sendEmail = (data: EmailData) =>
  Effect.serviceWithEffect(EmailService.tag, (service) => service.send(data));
