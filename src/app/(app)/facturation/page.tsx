import { requireContext } from "@/lib/context";

export const metadata = { title: "Facturation — RelanceDevis AI" };

export default async function Facturation() {
  const { supabase } = await requireContext();
  const { data: sub } = await supabase
    .from("subscriptions").select("status, plan_id, current_period_end, cancel_at_period_end").maybeSingle();

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Facturation</h1>
      <div className="card max-w-xl">
        {sub ? (
          <p>Offre : <strong>{sub.plan_id}</strong> · Statut : <strong>{sub.status}</strong></p>
        ) : (
          <p>Aucun abonnement actif.</p>
        )}
        <p className="mt-3 text-sm text-slate-500">
          Le paiement et la gestion de l'abonnement (changement d'offre, résiliation, factures) seront
          activés avec l'intégration Stripe. Sans abonnement actif, aucune relance n'est envoyée.
        </p>
      </div>
    </>
  );
}
