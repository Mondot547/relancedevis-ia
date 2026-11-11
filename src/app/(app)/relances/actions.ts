"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, requireContext } from "@/lib/context";

const schema = z.object({ id: z.string().uuid(), action: z.enum(["pause", "resume"]) });

export async function toggleCampaign(formData: FormData) {
  const { supabase } = await requireContext();
  const p = schema.safeParse({ id: formData.get("id"), action: formData.get("action") });
  if (!p.success) fail("/relances", "Action invalide.");

  const patch = p.data.action === "pause"
    ? { status: "paused", paused_at: new Date().toISOString() }
    : { status: "active", paused_at: null };
  // On ne touche qu'aux campagnes encore en cours (jamais celles arrêtées par un devis clos).
  const { error } = await supabase.from("follow_up_campaigns")
    .update(patch).eq("id", p.data.id).in("status", ["active", "paused"]);
  if (error) fail("/relances", "Mise à jour impossible.");
  revalidatePath("/relances");
  redirect("/relances");
}
