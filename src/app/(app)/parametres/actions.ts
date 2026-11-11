"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, requireContext } from "@/lib/context";
import { validateDelays } from "@/lib/followup/engine";

const schema = z.object({
  name: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire.").max(200),
  sender_name: z.string().trim().max(120),
  reply_to_email: z.string().trim().email("Email de réponse invalide.").or(z.literal("")),
  start: z.coerce.number().int().min(0).max(23),
  end: z.coerce.number().int().min(1).max(24),
  delays: z.string(),
});

export async function updateSettings(formData: FormData) {
  const { supabase, orgId } = await requireContext();
  const p = schema.safeParse({
    name: formData.get("name"),
    sender_name: formData.get("sender_name") ?? "",
    reply_to_email: formData.get("reply_to_email") ?? "",
    start: formData.get("start"),
    end: formData.get("end"),
    delays: formData.get("delays") ?? "",
  });
  if (!p.success) fail("/parametres", p.error.issues[0].message);
  if (p.data.end <= p.data.start) fail("/parametres", "L'heure de fin doit être après l'heure de début.");

  const delays = p.data.delays.split(",").map((s) => Number(s.trim()));
  const delayError = validateDelays(delays);
  if (delayError) fail("/parametres", delayError);

  const days = formData.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (days.length === 0) fail("/parametres", "Choisissez au moins un jour d'envoi.");

  const { error } = await supabase.from("organizations").update({
    name: p.data.name,
    sender_name: p.data.sender_name || null,
    reply_to_email: p.data.reply_to_email || null,
    send_window_start: p.data.start,
    send_window_end: p.data.end,
    send_days: days,
    default_delays: delays,
  }).eq("id", orgId);
  if (error) fail("/parametres", "Seul le responsable de l'entreprise peut modifier ces paramètres.");
  revalidatePath("/parametres");
  redirect("/parametres?info=" + encodeURIComponent("Paramètres enregistrés. Ils s'appliquent aux prochains devis."));
}
