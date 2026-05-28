import { SignJWT, importPKCS8 } from "jose";

export async function createGitHubAppJwt(input: {
  appId: string;
  now?: Date;
  privateKey: string;
}): Promise<string> {
  const key = await importPKCS8(input.privateKey, "RS256");
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 9 * 60)
    .setIssuer(input.appId)
    .sign(key);
}
