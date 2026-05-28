const portlessUrl = process.env.PORTLESS_URL;

if (portlessUrl) {
  const url = new URL(portlessUrl);
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  const params = new URLSearchParams({
    host: url.hostname,
    port,
  });

  console.log(
    `\nPortless Drizzle Studio: https://local.drizzle.studio?${params.toString()}\n`
  );
}
