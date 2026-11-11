import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideSend, nextAllowedSlot, retryDelayMs, type SendWindow } from "@/lib/followup/engine";
import { buildEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { unsubscribeUrl } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof createAdminClient>;
type Outcome = "sent" | "cancelled" | "rescheduled" | "retry" | "failed";

interface ClaimedLog {
  id: string; organization_id: string; campaign_id: string; quote_id: string;
  step: number; attempts: number; sent_at: string | null;
}

async function processOne(db: Db, log: ClaimedLog, siteUrl: string, fromAddress: string): Promise<Outcome> {
  const [{ data: quote }, { data: campaign }, { data: org }] = await Promise.all([
    db.from("quotes")
      .select("id, title, amount_cents, status, responded_at, prospects(id, full_name, email, email_opt_out)")
      .eq("id", log.quote_id).single(),
    db.from("follow_up_campaigns").select("status, use_ai").eq("id", log.campaign_id).single(),
    db.from("organizations")
      .select("name, sender_name, reply_to_email, timezone, send_window_start, send_window_end, send_days, ai_requires_validation")
      .eq("id", log.organization_id).single(),
  ]);
  const rel = quote?.prospects as unknown;
  const prospect = (Array.isArray(rel) ? rel[0] : rel) as
    | { id: string; full_name: string; email: string | null; email_opt_out: boolean }
    | undefined;
  if (!quote || !campaign || !org || !prospect) {
    await db.from("follow_up_logs").update({ status: "cancelled", error: "données introuvables", locked_at: null }).eq("id", log.id);
    return "cancelled";
  }

  // 1. Horaires d'envoi (réévalués au moment de l'envoi)
  const window: SendWindow = {
    timezone: org.timezone, startHour: org.send_window_start, endHour: org.send_window_end, days: org.send_days,
  };
  const now = new Date();
  const slot = nextAllowedSlot(now, window);
  if (slot.getTime() !== now.getTime()) {
    await db.from("follow_up_logs").update({
      status: "scheduled", scheduled_at: slot.toISOString(), locked_at: null, attempts: Math.max(0, log.attempts - 1),
    }).eq("id", log.id);
    return "rescheduled";
  }

  // 2. Dernier contrôle avant envoi
  const decision = decideSend({
    quoteStatus: quote.status, respondedAt: quote.responded_at ? new Date(quote.responded_at) : null,
    campaignStatus: campaign.status, prospectEmail: prospect.email, prospectOptedOut: prospect.email_opt_out,
    alreadySent: !!log.sent_at, usesAi: campaign.use_ai, aiRequiresValidation: org.ai_requires_validation,
    aiDraftApproved: false, // l'IA n'est pas encore branchée : aucun message IA ne part
  });
  if (!decision.send) {
    if (decision.reason === "campaign_not_active") {
      await db.from("follow_up_logs").update({
        status: "scheduled", locked_at: null, attempts: Math.max(0, log.attempts - 1),
      }).eq("id", log.id);
      return "rescheduled";
    }
    await db.from("follow_up_logs").update({ status: "cancelled", error: decision.reason, locked_at: null }).eq("id", log.id);
    return "cancelled";
  }

  // 3. Envoi
  const links = await unsubscribeUrl(siteUrl, prospect.id);
  const company = org.sender_name || org.name;
  const mail = buildEmail({
    step: log.step, prospectName: prospect.full_name, quoteTitle: quote.title,
    amountCents: Number(quote.amount_cents), companyName: company, unsubscribePageUrl: links.page,
  });
  const result = await sendEmail({
    from: `${company.replace(/[<>"]/g, "")} <${fromAddress}>`,
    to: prospect.email as string, subject: mail.subject, html: mail.html, text: mail.text,
    replyTo: org.reply_to_email, unsubscribeOneClickUrl: links.oneClick, idempotencyKey: log.id,
  });

  if (result.ok) {
    await db.from("follow_up_logs").update({
      status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.id,
      subject: mail.subject, body: mail.text, error: null, locked_at: null,
    }).eq("id", log.id);
    return "sent";
  }

  // 4. Échec : nouvelle tentative différée, puis abandon + notification
  const delay = retryDelayMs(log.attempts);
  if (delay === null) {
    await db.from("follow_up_logs").update({ status: "failed", error: result.error, locked_at: null }).eq("id", log.id);
    await db.from("notifications").insert({
      organization_id: log.organization_id, kind: "followup_failed",
      title: "Une relance n'a pas pu être envoyée",
      body: `Devis « ${quote.title} » : ${result.error}`,
    });
    return "failed";
  }
  await db.from("follow_up_logs").update({
    status: "failed", error: result.error, locked_at: null, scheduled_at: new Date(Date.now() + delay).toISOString(),
  }).eq("id", log.id);
  return "retry";
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !fromAddress || !siteUrl) {
    return NextResponse.json({ error: "envoi d'emails non configuré" }, { status: 503 });
  }

  const db = createAdminClient();
  const { data: claimed, error } = await db.rpc("claim_due_followups", { batch_size: 25, max_attempts: 3 });
  if (error) return NextResponse.json({ error: "réservation impossible" }, { status: 500 });

  const summary: Record<Outcome, number> = { sent: 0, cancelled: 0, rescheduled: 0, retry: 0, failed: 0 };
  for (const log of (claimed ?? []) as ClaimedLog[]) {
    try {
      summary[await processOne(db, log, siteUrl, fromAddress)]++;
    } catch (e) {
      // Erreur technique : journalisée, la relance sera reprise (verrou périmé après 15 min)
      await db.from("audit_logs").insert({
        organization_id: log.organization_id, action: "followup_error", entity: "follow_up_logs", entity_id: log.id,
        metadata: { message: e instanceof Error ? e.message : String(e) },
      });
      summary.failed++;
    }
  }
  return NextResponse.json({ claimed: (claimed ?? []).length, ...summary });
}
