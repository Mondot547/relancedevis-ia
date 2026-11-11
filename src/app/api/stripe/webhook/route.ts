import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { mapSubscription, type StripeSubLike } from "@/lib/stripe/map";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof createAdminClient>;

async function orgForSubscription(db: Db, sub: StripeSubLike): Promise<string | null> {
  const fromMeta = sub.metadata?.organization_id;
  if (fromMeta) return fromMeta;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await db.from("subscriptions").select("organization_id").eq("stripe_customer_id", customer).maybeSingle();
  return data?.organization_id ?? null;
}

async function syncSubscription(db: Db, orgId: string, sub: StripeSubLike) {
  const row = mapSubscription(sub);
  const { error } = await db.from("subscriptions").upsert({ organization_id: orgId, ...row }, { onConflict: "organization_id" });
  if (error) throw new Error(`Synchronisation de l'abonnement impossible : ${error.message}`);
}

async function handle(db: Db, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode !== "subscription" || !s.subscription || !s.client_reference_id) return;
      const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
      const sub = await getStripe().subscriptions.retrieve(subId);
      await syncSubscription(db, s.client_reference_id, sub as unknown as StripeSubLike);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as unknown as StripeSubLike;
      const orgId = await orgForSubscription(db, sub);
      if (!orgId) throw new Error("Abonnement Stripe sans entreprise associée");
      await syncSubscription(db, orgId, sub);
      return;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      if (!customer) return;
      const { data } = await db.from("subscriptions").select("organization_id").eq("stripe_customer_id", customer).maybeSingle();
      if (!data) return;
      await db.from("notifications").insert({
        organization_id: data.organization_id,
        kind: "payment_failed",
        title: "Paiement de votre abonnement refusé",
        body: "Mettez à jour votre moyen de paiement dans Facturation pour que les relances continuent.",
      });
      return;
    }
    default:
      return; // autres événements ignorés
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret) return NextResponse.json({ error: "webhook non configuré" }, { status: 503 });
  if (!signature) return NextResponse.json({ error: "signature manquante" }, { status: 400 });

  const body = await request.text(); // corps brut, indispensable à la vérification
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: seen } = await db.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    await handle(db, event);
  } catch (e) {
    await db.from("audit_logs").insert({
      action: "stripe_webhook_error", entity: "stripe_events",
      metadata: { event: event.id, type: event.type, message: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json({ error: "traitement échoué" }, { status: 500 }); // Stripe réessaiera
  }
  await db.from("stripe_events").insert({ id: event.id, type: event.type });
  return NextResponse.json({ received: true });
}
