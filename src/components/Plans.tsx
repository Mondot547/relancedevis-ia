import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { euro } from "@/lib/format";

const FEATURES: Record<string, string[]> = {
  essentiel: ["Gestion des devis et des prospects", "Relances automatiques J+3 / J+7 / J+14", "Tableau de bord"],
  pro: ["Tout Essentiel", "Relances personnalisées", "Statistiques avancées", "Historique complet", "Modèles d'emails"],
  business: ["Tout Pro", "Plusieurs utilisateurs", "Collaboration", "Paramètres avancés"],
};

export async function Plans() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans").select("id, name, price_monthly_cents, price_yearly_cents").eq("active", true).order("sort_order");

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {(plans ?? []).map((p) => (
        <div key={p.id} className={`card flex flex-col ${p.id === "pro" ? "ring-2 ring-indigo-500" : ""}`}>
          {p.id === "pro" && <span className="mb-2 w-fit rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">Le plus choisi</span>}
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <p className="mt-2 text-3xl font-bold">{euro(p.price_monthly_cents)}<span className="text-sm font-normal text-slate-500"> /mois</span></p>
          <p className="text-sm text-slate-500">ou {euro(p.price_yearly_cents)} /an</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
            {(FEATURES[p.id] ?? []).map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
          <Link href="/inscription" className="btn mt-6">Commencer</Link>
        </div>
      ))}
    </div>
  );
}
