export class ClerkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClerkError";
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownError";
  }
}

export class WaitlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WaitlistError";
  }
}
