"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, requireContext } from "@/lib/context";

const schema = z.object({
  full_name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  email: z.string().trim().email("Email invalide.").or(z.literal("")),
  phone: z.string().trim().max(30),
  company: z.string().trim().max(200),
});

export async function createProspect(formData: FormData) {
  const { supabase, orgId } = await requireContext();
  const p = schema.safeParse({
    full_name: formData.get("full_name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    company: formData.get("company") ?? "",
  });
  if (!p.success) fail("/prospects", p.error.issues[0].message);
  const { error } = await supabase.from("prospects").insert({
    organization_id: orgId,
    full_name: p.data.full_name,
    email: p.data.email || null,
    phone: p.data.phone || null,
    company: p.data.company || null,
  });
  if (error) fail("/prospects", "Enregistrement impossible.");
  revalidatePath("/prospects");
  redirect("/prospects");
}

export async function deleteProspect(formData: FormData) {
  const { supabase } = await requireContext();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) fail("/prospects", "Prospect introuvable.");
  const { error } = await supabase.from("prospects").delete().eq("id", id.data);
  if (error) fail("/prospects", "Suppression impossible.");
  revalidatePath("/prospects");
  redirect("/prospects");
}
