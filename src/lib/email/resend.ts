export interface SendParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  unsubscribeOneClickUrl: string;
  idempotencyKey: string; // empêche tout doublon d'envoi, même si le moteur retente
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(p: SendParams): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY manquante" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": p.idempotencyKey,
      },
      body: JSON.stringify({
        from: p.from,
        to: [p.to],
        subject: p.subject,
        html: p.html,
        text: p.text,
        ...(p.replyTo ? { reply_to: p.replyTo } : {}),
        headers: {
          "List-Unsubscribe": `<${p.unsubscribeOneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !json.id) return { ok: false, error: json.message ?? `Resend HTTP ${res.status}` };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau" };
  }
}
