"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, requireContext } from "@/lib/context";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

async function siteUrl() {
  const h = await headers();
  return (process.env.NEXT_PUBLIC_SITE_URL ?? h.get("origin") ?? "http://localhost:3000").replace(/\/$/, "");
}

async function getOrCreateCustomer(orgId: string, email: string | undefined, orgName: string): Promise<string> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("subscriptions").select("stripe_customer_id").eq("organization_id", orgId).maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;
  const customer = await getStripe().customers.create({ email, name: orgName, metadata: { organization_id: orgId } });
  await admin.from("subscriptions").upsert(
    { organization_id: orgId, stripe_customer_id: customer.id, status: "incomplete" },
    { onConflict: "organization_id" },
  );
  return customer.id;
}

const checkoutSchema = z.object({ plan: z.string().min(1).max(40), interval: z.enum(["month", "year"]) });

export async function startCheckout(formData: FormData) {
  const { supabase, user, orgId, role } = await requireContext();
  if (role !== "owner" && role !== "admin") fail("/facturation", "Seul le responsable peut gérer l'abonnement.");
  const p = checkoutSchema.safeParse({ plan: formData.get("plan"), interval: formData.get("interval") });
  if (!p.success) fail("/facturation", "Offre invalide.");

  const { data: current } = await supabase.from("subscriptions").select("status, cancel_at_period_end").maybeSingle();
  if (current && ["active", "trialing", "past_due"].includes(current.status) && !current.cancel_at_period_end) {
    fail("/facturation", "Vous avez déjà un abonnement : utilisez « Gérer mon abonnement » pour changer d'offre.");
  }

  const { data: plan } = await supabase
    .from("plans").select("id, stripe_price_monthly, stripe_price_yearly").eq("id", p.data.plan).eq("active", true).maybeSingle();
  const priceId = p.data.interval === "month" ? plan?.stripe_price_monthly : plan?.stripe_price_yearly;
  if (!plan || !priceId) fail("/facturation", "Cette offre n'est pas encore disponible à l'achat.");

  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  let url: string | null = null;
  try {
    const customer = await getOrCreateCustomer(orgId, user.email, org?.name ?? "");
    const base = await siteUrl();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { organization_id: orgId, plan_id: plan.id, interval: p.data.interval } },
      allow_promotion_codes: true,
      locale: "fr",
      success_url: `${base}/facturation?info=${encodeURIComponent("Merci ! Votre abonnement est en cours d'activation.")}`,
      cancel_url: `${base}/facturation`,
    });
    url = session.url;
  } catch {
    fail("/facturation", "Le paiement n'est pas disponible pour le moment. Réessayez plus tard.");
  }
  if (!url) fail("/facturation", "Le paiement n'est pas disponible pour le moment.");
  redirect(url);
}

export async function openPortal() {
  const { supabase, role } = await requireContext();
  if (role !== "owner" && role !== "admin") fail("/facturation", "Seul le responsable peut gérer l'abonnement.");
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").maybeSingle();
  if (!sub?.stripe_customer_id) fail("/facturation", "Aucun abonnement à gérer.");
  let url: string | null = null;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${await siteUrl()}/facturation`,
    });
    url = session.url;
  } catch {
    fail("/facturation", "Le portail de facturation n'est pas disponible pour le moment.");
  }
  redirect(url);
}
