import { requireContext } from "@/lib/context";
import { Banner } from "@/components/Banner";
import { updateSettings } from "./actions";

export const metadata = { title: "Paramètres — RelanceDevis AI" };

const DAYS: [number, string][] = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [7, "Dim"]];

export default async function Parametres({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const sp = await searchParams;
  const { supabase, orgId } = await requireContext();
  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  const days: number[] = org?.send_days ?? [1, 2, 3, 4, 5];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Paramètres</h1>
      <Banner erreur={sp.erreur} info={sp.info} />
      <form action={updateSettings} className="card max-w-2xl space-y-4">
        <div><label className="label" htmlFor="name">Nom de l'entreprise</label><input className="input" id="name" name="name" defaultValue={org?.name} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="sender_name">Nom d'expéditeur des relances</label><input className="input" id="sender_name" name="sender_name" defaultValue={org?.sender_name ?? ""} /></div>
          <div><label className="label" htmlFor="reply_to_email">Email de réponse</label><input className="input" id="reply_to_email" name="reply_to_email" type="email" defaultValue={org?.reply_to_email ?? ""} /></div>
        </div>
        <div><label className="label" htmlFor="delays">Délais de relance (jours, séparés par des virgules)</label>
          <input className="input" id="delays" name="delays" defaultValue={(org?.default_delays ?? [3, 7, 14]).join(", ")} />
          <p className="mt-1 text-xs text-slate-500">Exemple : 3, 7, 14 = relances à J+3, J+7 et J+14.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="start">Envoi à partir de (heure)</label><input className="input" id="start" name="start" type="number" min={0} max={23} defaultValue={org?.send_window_start ?? 9} /></div>
          <div><label className="label" htmlFor="end">Jusqu'à (heure)</label><input className="input" id="end" name="end" type="number" min={1} max={24} defaultValue={org?.send_window_end ?? 18} /></div>
        </div>
        <fieldset><legend className="label">Jours d'envoi</legend>
          <div className="flex flex-wrap gap-3">
            {DAYS.map(([n, label]) => (
              <label key={n} className="flex items-center gap-1 text-sm"><input type="checkbox" name="days" value={n} defaultChecked={days.includes(n)} /> {label}</label>
            ))}
          </div></fieldset>
        <button className="btn">Enregistrer</button>
      </form>
    </>
  );
}
