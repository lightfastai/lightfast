import type { Source } from "nosecone";

/**
 * Content Security Policy directive configuration
 * Represents a single CSP directive (e.g., scriptSrc, connectSrc)
 */
export type CspDirective = Source[];

/**
 * Content Security Policy directives collection
 * Each key is a CSP directive name, value is array of allowed sources
 */
export interface CspDirectives {
  baseUri?: CspDirective;
  childSrc?: CspDirective;
  connectSrc?: CspDirective;
  defaultSrc?: CspDirective;
  fontSrc?: CspDirective;
  formAction?: CspDirective;
  frameAncestors?: CspDirective;
  frameSrc?: CspDirective;
  imgSrc?: CspDirective;
  manifestSrc?: CspDirective;
  mediaSrc?: CspDirective;
  objectSrc?: CspDirective;
  scriptSrc?: CspDirective;
  styleSrc?: CspDirective;
  workerSrc?: CspDirective;
}

/**
 * Partial CSP configuration for composition
 * Allows individual modules to contribute specific directives
 */
export type PartialCspDirectives = Partial<CspDirectives>;
