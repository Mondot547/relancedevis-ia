import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Utilisateur connecté + son entreprise. Redirige vers la connexion sinon. */
export async function requireContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data: m } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m) redirect("/connexion");
  return { supabase, user, orgId: m.organization_id as string, role: m.role as string };
}

/** Redirection avec message d'erreur affiché sur la page. */
export function fail(path: string, message: string): never {
  redirect(`${path}?erreur=${encodeURIComponent(message)}`);
}
