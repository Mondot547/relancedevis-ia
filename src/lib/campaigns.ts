import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WINDOW, planFollowUps, type SendWindow } from "@/lib/followup/engine";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Crée la campagne de relance d'un devis envoyé (si elle n'existe pas) et calcule le calendrier.
 * La campagne est créée avec le client utilisateur (la RLS vérifie l'appartenance à l'entreprise) ;
 * les lignes de relance, réservées au moteur, sont écrites avec le client service_role.
 * Les étapes déjà dépassées sont marquées « skipped » : aucune rafale d'emails sur un vieux devis.
 */
export async function ensureCampaign(supabase: SupabaseClient, orgId: string, quoteId: string, sentAt: Date) {
  const { data: existing } = await supabase
    .from("follow_up_campaigns").select("id").eq("quote_id", quoteId).maybeSingle();
  if (existing) return;

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone, send_window_start, send_window_end, send_days, default_delays")
    .eq("id", orgId).single();

  const window: SendWindow = org
    ? { timezone: org.timezone, startHour: org.send_window_start, endHour: org.send_window_end, days: org.send_days }
    : DEFAULT_WINDOW;
  const delays: number[] = org?.default_delays ?? [3, 7, 14];

  const { data: campaign, error } = await supabase
    .from("follow_up_campaigns")
    .insert({ organization_id: orgId, quote_id: quoteId, delays })
    .select("id").single();
  if (error || !campaign) throw new Error("Création de la campagne de relance impossible.");

  const now = Date.now();
  const rows = planFollowUps(sentAt, delays, window).map((p) => ({
    organization_id: orgId,
    campaign_id: campaign.id,
    quote_id: quoteId,
    step: p.step,
    scheduled_at: p.scheduledAt.toISOString(),
    status: p.scheduledAt.getTime() < now ? "skipped" : "scheduled",
  }));
  const { error: logError } = await createAdminClient().from("follow_up_logs").insert(rows);
  if (logError) throw new Error("Calendrier de relance impossible à enregistrer.");
}
