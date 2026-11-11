"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, requireContext } from "@/lib/context";
import { ensureCampaign } from "@/lib/campaigns";

const createSchema = z.object({
  prospect_id: z.string().uuid("Choisissez un prospect."),
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(300),
  amount: z.coerce.number().min(0, "Montant invalide.").max(10_000_000, "Montant invalide."),
  status: z.enum(["draft", "sent"]),
  sent_at: z.string(),
});

export async function createQuote(formData: FormData) {
  const { supabase, orgId } = await requireContext();
  const p = createSchema.safeParse({
    prospect_id: formData.get("prospect_id"),
    title: formData.get("title"),
    amount: formData.get("amount") || 0,
    status: formData.get("status"),
    sent_at: formData.get("sent_at") ?? "",
  });
  if (!p.success) fail("/devis", p.error.issues[0].message);

  const sentAt = p.data.status === "sent"
    ? (p.data.sent_at ? new Date(`${p.data.sent_at}T09:00:00Z`) : new Date())
    : null;
  if (sentAt && Number.isNaN(sentAt.getTime())) fail("/devis", "Date d'envoi invalide.");

  const { data: quote, error } = await supabase.from("quotes").insert({
    organization_id: orgId,
    prospect_id: p.data.prospect_id,
    title: p.data.title,
    amount_cents: Math.round(p.data.amount * 100),
    status: p.data.status,
    sent_at: sentAt?.toISOString() ?? null,
  }).select("id").single();
  if (error || !quote) fail("/devis", "Enregistrement impossible.");

  if (sentAt) {
    try {
      await ensureCampaign(supabase, orgId, quote.id, sentAt);
    } catch {
      fail("/devis", "Devis enregistré, mais la programmation des relances a échoué. Réessayez depuis la page Relances.");
    }
  }
  revalidatePath("/devis");
  revalidatePath("/relances");
  redirect("/devis");
}

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["send", "accepted", "rejected", "responded"]),
});

export async function updateQuote(formData: FormData) {
  const { supabase, orgId } = await requireContext();
  const p = actionSchema.safeParse({ id: formData.get("id"), action: formData.get("action") });
  if (!p.success) fail("/devis", "Action invalide.");

  if (p.data.action === "responded") {
    // le trigger SQL annule toutes les relances en attente
    const { error } = await supabase.from("quotes")
      .update({ responded_at: new Date().toISOString() }).eq("id", p.data.id);
    if (error) fail("/devis", "Mise à jour impossible.");
  } else if (p.data.action === "send") {
    const now = new Date();
    const { error } = await supabase.from("quotes")
      .update({ status: "sent", sent_at: now.toISOString() }).eq("id", p.data.id).eq("status", "draft");
    if (error) fail("/devis", "Mise à jour impossible.");
    try {
      await ensureCampaign(supabase, orgId, p.data.id, now);
    } catch {
      fail("/devis", "Devis marqué envoyé, mais la programmation des relances a échoué.");
    }
  } else {
    // accepté / refusé : le trigger SQL annule toutes les relances en attente
    const { error } = await supabase.from("quotes").update({ status: p.data.action }).eq("id", p.data.id);
    if (error) fail("/devis", "Mise à jour impossible.");
  }
  revalidatePath("/devis");
  revalidatePath("/relances");
  redirect("/devis");
}
