// Conversion d'un abonnement Stripe vers notre table `subscriptions`. Fonction pure : testable sans Stripe.

export interface StripeSubLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: { data: { current_period_start?: number | null; current_period_end?: number | null }[] };
  metadata?: Record<string, string> | null;
}

export type OurStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";

export function mapStatus(s: string): OurStatus {
  switch (s) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "incomplete": return "incomplete";
    case "incomplete_expired": return "canceled";
    case "unpaid": return "unpaid";
    case "paused": return "unpaid"; // jamais « actif » par défaut : aucune relance ne part
    default: return "unpaid";
  }
}

const iso = (t: number | null | undefined) => (typeof t === "number" ? new Date(t * 1000).toISOString() : null);

export function mapSubscription(sub: StripeSubLike) {
  const item = sub.items?.data?.[0];
  const interval = sub.metadata?.interval;
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: mapStatus(sub.status),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_start: iso(sub.current_period_start ?? item?.current_period_start),
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    plan_id: sub.metadata?.plan_id ?? null,
    billing_interval: interval === "month" || interval === "year" ? interval : null,
  };
}
