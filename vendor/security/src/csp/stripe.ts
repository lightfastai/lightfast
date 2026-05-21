import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Stripe.
 *
 * The app does not use Stripe directly — Clerk's billing components
 * (`PaymentElement`, `CheckoutProvider`) embed Stripe Elements as cross-origin
 * scripts and iframes, so these domains exist solely to let Clerk billing
 * render. Without them the payment form is stuck on "Loading payment
 * element..." because Stripe.js is refused by `script-src`.
 *
 * Domains match Clerk's published billing CSP defaults
 * (https://clerk.com/docs/security/clerk-csp) and Stripe's CSP guide
 * (https://docs.stripe.com/security/guide#content-security-policy).
 *
 * IMPORTANT: Stripe Elements is also incompatible with
 * `Cross-Origin-Embedder-Policy: require-corp`. js.stripe.com / hooks.stripe.com
 * send no `Cross-Origin-Resource-Policy` header, so a cross-origin-isolated page
 * blocks the Stripe iframe before CSP is even evaluated. Any app composing these
 * directives must also disable COEP (`crossOriginEmbedderPolicy: false`).
 *
 * @returns Partial CSP directives for Stripe (required by Clerk billing)
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createClerkCspDirectives(),
 *   createStripeCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createStripeCspDirectives(): PartialCspDirectives {
  return {
    // Scripts: Stripe.js loader and its lazily-loaded chunks
    scriptSrc: ["https://js.stripe.com", "https://*.js.stripe.com"],

    // Frames: the PaymentElement iframe + the 3D Secure (hooks) iframe
    frameSrc: [
      "https://js.stripe.com",
      "https://*.js.stripe.com",
      "https://hooks.stripe.com",
    ],

    // Connections: Stripe API for tokenization / payment method creation
    connectSrc: ["https://api.stripe.com"],
  };
}
