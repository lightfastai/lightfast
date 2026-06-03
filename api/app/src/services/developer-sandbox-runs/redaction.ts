const MIN_SECRET_LENGTH = 4;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(text: string, secrets: string[]) {
  let redacted = text;
  let redactionCount = 0;
  const uniqueSecrets = Array.from(new Set(secrets)).filter(
    (secret) => secret.length >= MIN_SECRET_LENGTH
  );

  for (const secret of uniqueSecrets) {
    const pattern = new RegExp(escapeRegExp(secret), "g");
    redacted = redacted.replace(pattern, () => {
      redactionCount += 1;
      return "[redacted]";
    });
  }

  return { text: redacted, redactionCount };
}
