"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/context";

const emailSchema = z.string().trim().email("Adresse email invalide.");
const passwordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128);

async function origin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signIn(formData: FormData) {
  const p = z.object({ email: emailSchema, password: passwordSchema })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!p.success) fail("/connexion", "Email ou mot de passe incorrect.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(p.data);
  if (error) fail("/connexion", "Email ou mot de passe incorrect.");
  redirect("/tableau-de-bord");
}

export async function signUp(formData: FormData) {
  const p = z.object({
    email: emailSchema,
    password: passwordSchema,
    full_name: z.string().trim().min(1, "Indiquez votre nom.").max(120),
    company_name: z.string().trim().min(1, "Indiquez le nom de votre entreprise.").max(200),
    cgu: z.literal("on", { errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }) }),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
    company_name: formData.get("company_name"),
    cgu: formData.get("cgu"),
  });
  if (!p.success) fail("/inscription", p.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email,
    password: p.data.password,
    options: {
      data: { full_name: p.data.full_name, company_name: p.data.company_name },
      emailRedirectTo: `${await origin()}/auth/callback`,
    },
  });
  if (error) fail("/inscription", "Inscription impossible. Vérifiez vos informations ou essayez de vous connecter.");
  if (data.session) redirect("/tableau-de-bord");
  redirect(`/connexion?info=${encodeURIComponent("Compte créé. Confirmez votre adresse email grâce au message que nous venons de vous envoyer.")}`);
}

export async function requestPasswordReset(formData: FormData) {
  const p = emailSchema.safeParse(formData.get("email"));
  if (!p.success) fail("/mot-de-passe-oublie", "Adresse email invalide.");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(p.data, {
    redirectTo: `${await origin()}/auth/callback?next=/parametres`,
  });
  // Même message que le compte existe ou non : pas de fuite d'information.
  redirect(`/connexion?info=${encodeURIComponent("Si ce compte existe, un email de réinitialisation vient d'être envoyé.")}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
