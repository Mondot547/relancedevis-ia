import { requireContext } from "@/lib/context";
import { Banner } from "@/components/Banner";
import { dateFr } from "@/lib/format";
import { createProspect, deleteProspect } from "./actions";

export const metadata = { title: "Prospects — RelanceDevis AI" };

export default async function Prospects({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireContext();
  const { data } = await supabase
    .from("prospects").select("id, full_name, email, phone, company, email_opt_out, created_at")
    .order("created_at", { ascending: false });
  const prospects = (data ?? []) as {
    id: string; full_name: string; email: string | null; phone: string | null;
    company: string | null; email_opt_out: boolean; created_at: string;
  }[];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Prospects</h1>
      <Banner erreur={sp.erreur} />
      <form action={createProspect} className="card mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div><label className="label" htmlFor="full_name">Nom</label><input className="input" id="full_name" name="full_name" required /></div>
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" /></div>
        <div><label className="label" htmlFor="phone">Téléphone</label><input className="input" id="phone" name="phone" type="tel" /></div>
        <div><label className="label" htmlFor="company">Société</label><input className="input" id="company" name="company" /></div>
        <div className="flex items-end"><button className="btn w-full">Ajouter</button></div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Ajouté le</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {prospects.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Aucun prospect pour l'instant.</td></tr>}
            {prospects.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium">{p.full_name}{p.company ? <span className="text-slate-500"> · {p.company}</span> : null}</td>
                <td className="px-4 py-3">{p.email ?? "—"}{p.email_opt_out && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">désinscrit</span>}</td>
                <td className="px-4 py-3">{p.phone ?? "—"}</td>
                <td className="px-4 py-3">{dateFr(p.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteProspect}><input type="hidden" name="id" value={p.id} /><button className="text-rose-700 hover:underline">Supprimer</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
