// Lien de désinscription signé (HMAC) : impossible à deviner ou à falsifier.
// Aucune dépendance au framework : testable avec `node --test`.

function secret(): string {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error("CRON_SECRET manquante");
  return `unsub:${s}`;
}

async function sign(prospectId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(prospectId));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function unsubscribeToken(prospectId: string): Promise<string> {
  return sign(prospectId);
}

export async function verifyUnsubscribeToken(prospectId: string, token: string): Promise<boolean> {
  const expected = await sign(prospectId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function unsubscribeUrl(siteUrl: string, prospectId: string): Promise<{ page: string; oneClick: string }> {
  const token = await unsubscribeToken(prospectId);
  const base = siteUrl.replace(/\/$/, "");
  return {
    page: `${base}/desinscription/${prospectId}/${token}`,
    oneClick: `${base}/api/desinscription/${prospectId}/${token}`,
  };
}
