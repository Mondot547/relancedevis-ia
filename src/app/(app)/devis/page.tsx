import Link from "next/link";
import { requireContext } from "@/lib/context";
import { Banner } from "@/components/Banner";
import { QUOTE_STATUS, dateFr, euro } from "@/lib/format";
import { createQuote, updateQuote } from "./actions";

export const metadata = { title: "Devis — RelanceDevis AI" };

type QuoteRow = {
  id: string; title: string; amount_cents: number; status: string;
  sent_at: string | null; responded_at: string | null; prospects: { full_name: string } | null;
};

function ActionButton({ id, action, label }: { id: string; action: string; label: string }) {
  return (
    <form action={updateQuote}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button className="btn-secondary">{label}</button>
    </form>
  );
}

export default async function Devis({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireContext();
  const [{ data: prospectsData }, { data: quotesData }] = await Promise.all([
    supabase.from("prospects").select("id, full_name").order("full_name"),
    supabase.from("quotes")
      .select("id, title, amount_cents, status, sent_at, responded_at, prospects(full_name)")
      .order("created_at", { ascending: false }),
  ]);
  const prospects = (prospectsData ?? []) as { id: string; full_name: string }[];
  const quotes = (quotesData ?? []) as unknown as QuoteRow[];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Devis</h1>
      <Banner erreur={sp.erreur} />

      {prospects.length === 0 ? (
        <p className="card mb-8 text-slate-600">
          Ajoutez d'abord un prospect dans <Link href="/prospects" className="text-indigo-700">Prospects</Link>.
        </p>
      ) : (
        <form action={createQuote} className="card mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2"><label className="label" htmlFor="prospect_id">Prospect</label>
            <select className="input" id="prospect_id" name="prospect_id" required>
              {prospects.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select></div>
          <div className="lg:col-span-2"><label className="label" htmlFor="title">Objet du devis</label><input className="input" id="title" name="title" required placeholder="Rénovation salle de bain" /></div>
          <div><label className="label" htmlFor="amount">Montant (€)</label><input className="input" id="amount" name="amount" type="number" min="0" step="0.01" required /></div>
          <div><label className="label" htmlFor="status">Statut</label>
            <select className="input" id="status" name="status" defaultValue="sent">
              <option value="sent">Envoyé (relances actives)</option><option value="draft">Brouillon</option>
            </select></div>
          <div><label className="label" htmlFor="sent_at">Date d'envoi</label><input className="input" id="sent_at" name="sent_at" type="date" /></div>
          <div className="flex items-end"><button className="btn w-full">Ajouter</button></div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr><th className="px-4 py-3">Devis</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Envoyé le</th><th className="px-4 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {quotes.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Aucun devis pour l'instant.</td></tr>}
            {quotes.map((q) => {
              const s = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.draft;
              return (
                <tr key={q.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-4 py-3"><p className="font-medium">{q.title}</p><p className="text-slate-500">{q.prospects?.full_name}</p></td>
                  <td className="px-4 py-3">{euro(q.amount_cents)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    {q.responded_at && <p className="mt-1 text-xs text-slate-500">Client a répondu</p>}
                  </td>
                  <td className="px-4 py-3">{dateFr(q.sent_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {q.status === "draft" && <ActionButton id={q.id} action="send" label="Marquer envoyé" />}
                      {q.status === "sent" && <>
                        <ActionButton id={q.id} action="accepted" label="Accepté" />
                        <ActionButton id={q.id} action="rejected" label="Refusé" />
                        {!q.responded_at && <ActionButton id={q.id} action="responded" label="Le client a répondu" />}
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
