import { requireContext } from "@/lib/context";
import { Banner } from "@/components/Banner";
import { dateFr, euro } from "@/lib/format";
import { openPortal, startCheckout } from "./actions";

export const metadata = { title: "Facturation — RelanceDevis AI" };

const STATUS: Record<string, string> = {
  active: "Actif", trialing: "Période d'essai", past_due: "Paiement en retard",
  canceled: "Résilié", incomplete: "Paiement non finalisé", unpaid: "Impayé",
};

export default async function Facturation({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const sp = await searchParams;
  const { supabase, role } = await requireContext();
  const [{ data: sub }, { data: plans }] = await Promise.all([
    supabase.from("subscriptions")
      .select("status, plan_id, billing_interval, current_period_end, cancel_at_period_end, stripe_customer_id").maybeSingle(),
    supabase.from("plans")
      .select("id, name, price_monthly_cents, price_yearly_cents, stripe_price_monthly, stripe_price_yearly")
      .eq("active", true).order("sort_order"),
  ]);
  const hasSub = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
  const canManage = role === "owner" || role === "admin";

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Facturation</h1>
      <Banner erreur={sp.erreur} info={sp.info} />

      <div className="card mb-8 max-w-xl">
        {sub && sub.status !== "incomplete" ? (
          <>
            <p>Offre : <strong>{plans?.find((p) => p.id === sub.plan_id)?.name ?? sub.plan_id ?? "—"}</strong> · Statut : <strong>{STATUS[sub.status] ?? sub.status}</strong></p>
            {sub.current_period_end && (
              <p className="mt-1 text-sm text-slate-600">
                {sub.cancel_at_period_end
                  ? `Résiliation programmée : vos relances continuent jusqu'au ${dateFr(sub.current_period_end)}, puis s'arrêtent.`
                  : `Prochain renouvellement : ${dateFr(sub.current_period_end)}.`}
              </p>
            )}
            {sub.status === "past_due" && <p className="mt-2 text-sm text-rose-700">Paiement refusé : les relances sont suspendues. Mettez à jour votre moyen de paiement.</p>}
            {sub.stripe_customer_id && canManage && (
              <form action={openPortal} className="mt-4"><button className="btn">Gérer mon abonnement et mes factures</button></form>
            )}
          </>
        ) : (
          <p>Aucun abonnement actif. Sans abonnement, aucune relance n'est envoyée.</p>
        )}
      </div>

      {(!hasSub || sub?.cancel_at_period_end) && canManage && (
        <div className="grid gap-6 md:grid-cols-3">
          {(plans ?? []).map((p) => (
            <div key={p.id} className="card">
              <h2 className="font-semibold">{p.name}</h2>
              <p className="mt-1 text-2xl font-bold">{euro(p.price_monthly_cents)}<span className="text-sm font-normal text-slate-500"> /mois</span></p>
              <div className="mt-4 flex flex-col gap-2">
                {([["month", "Mensuel", p.stripe_price_monthly, euro(p.price_monthly_cents) + " /mois"], ["year", "Annuel", p.stripe_price_yearly, euro(p.price_yearly_cents) + " /an"]] as const).map(([interval, label, priceId, price]) => (
                  <form key={interval} action={startCheckout}>
                    <input type="hidden" name="plan" value={p.id} />
                    <input type="hidden" name="interval" value={interval} />
                    <button className="btn-secondary w-full" disabled={!priceId}>{label} — {price}{priceId ? "" : " (bientôt)"}</button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
