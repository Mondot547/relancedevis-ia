import { requireContext } from "@/lib/context";
import { Banner } from "@/components/Banner";
import { FOLLOWUP_STATUS, dateTimeFr } from "@/lib/format";
import { toggleCampaign } from "./actions";

export const metadata = { title: "Relances — RelanceDevis AI" };

type Campaign = { id: string; status: string; delays: number[]; quotes: { title: string; prospects: { full_name: string } | null } | null };
type Log = { id: string; step: number; status: string; scheduled_at: string; sent_at: string | null; quotes: { title: string } | null };

const CAMPAIGN_LABEL: Record<string, string> = {
  active: "Active", paused: "En pause", completed: "Terminée", stopped: "Arrêtée",
};

export default async function Relances({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireContext();
  const [{ data: c }, { data: l }] = await Promise.all([
    supabase.from("follow_up_campaigns")
      .select("id, status, delays, quotes(title, prospects(full_name))")
      .order("created_at", { ascending: false }),
    supabase.from("follow_up_logs")
      .select("id, step, status, scheduled_at, sent_at, quotes(title)")
      .order("scheduled_at", { ascending: false }).limit(30),
  ]);
  const campaigns = (c ?? []) as unknown as Campaign[];
  const logs = (l ?? []) as unknown as Log[];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Relances</h1>
      <Banner erreur={sp.erreur} />

      <h2 className="mb-3 font-semibold">Campagnes</h2>
      <div className="card mb-8 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr><th className="px-4 py-3">Devis</th><th className="px-4 py-3">Délais</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan={4}>Aucune campagne. Elle se crée automatiquement quand un devis est marqué « envoyé ».</td></tr>}
            {campaigns.map((x) => (
              <tr key={x.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3"><p className="font-medium">{x.quotes?.title}</p><p className="text-slate-500">{x.quotes?.prospects?.full_name}</p></td>
                <td className="px-4 py-3">{x.delays.map((d) => `J+${d}`).join(", ")}</td>
                <td className="px-4 py-3">{CAMPAIGN_LABEL[x.status] ?? x.status}</td>
                <td className="px-4 py-3 text-right">
                  {(x.status === "active" || x.status === "paused") && (
                    <form action={toggleCampaign}>
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="action" value={x.status === "active" ? "pause" : "resume"} />
                      <button className="btn-secondary">{x.status === "active" ? "Suspendre" : "Reprendre"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 font-semibold">Historique</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr><th className="px-4 py-3">Devis</th><th className="px-4 py-3">Relance</th><th className="px-4 py-3">Prévue le</th><th className="px-4 py-3">Statut</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan={4}>Rien pour l'instant.</td></tr>}
            {logs.map((x) => (
              <tr key={x.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">{x.quotes?.title}</td>
                <td className="px-4 py-3">n° {x.step}</td>
                <td className="px-4 py-3">{dateTimeFr(x.scheduled_at)}</td>
                <td className="px-4 py-3">{FOLLOWUP_STATUS[x.status] ?? x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-slate-500">L'envoi réel des emails sera activé avec l'intégration Resend : pour l'instant, les relances sont programmées mais pas encore expédiées.</p>
    </>
  );
}
