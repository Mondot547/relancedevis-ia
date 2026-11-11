import { requireContext } from "@/lib/context";
import { euro } from "@/lib/format";

export const metadata = { title: "Tableau de bord — RelanceDevis AI" };

export default async function Dashboard() {
  const { supabase } = await requireContext();
  const { data: quotes } = await supabase.from("quotes").select("status, amount_cents");
  const { count: sentFollowUps } = await supabase
    .from("follow_up_logs").select("id", { count: "exact", head: true }).eq("status", "sent");

  const list = (quotes ?? []) as { status: string; amount_cents: number }[];
  const sent = list.filter((q) => q.status !== "draft");
  const pending = list.filter((q) => q.status === "sent");
  const accepted = list.filter((q) => q.status === "accepted");
  const rejected = list.filter((q) => q.status === "rejected");
  const potential = pending.reduce((s, q) => s + Number(q.amount_cents), 0);
  const conversion = sent.length ? Math.round((accepted.length / sent.length) * 100) : 0;

  const stats: [string, string][] = [
    ["Devis envoyés", String(sent.length)],
    ["En attente", String(pending.length)],
    ["Acceptés", String(accepted.length)],
    ["Refusés", String(rejected.length)],
    ["Relances envoyées", String(sentFollowUps ?? 0)],
    ["Montant potentiel", euro(potential)],
    ["Taux de conversion", `${conversion} %`],
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Tableau de bord</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {sent.length === 0 && (
        <p className="mt-8 text-slate-600">Commencez par ajouter un prospect, puis un devis : les relances se programment toutes seules.</p>
      )}
    </>
  );
}
