// SPDX-License-Identifier: Apache-2.0
// Relocated into the CLI; see ../../NOTICE and ../../LICENSE-APACHE-2.0.

export class NativeAuthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "NativeAuthError";
  }
}
