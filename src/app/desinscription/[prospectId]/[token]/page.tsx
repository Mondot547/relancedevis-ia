export const metadata = { title: "Désinscription", robots: { index: false } };

export default async function Desinscription({ params }: { params: Promise<{ prospectId: string; token: string }> }) {
  const { prospectId, token } = await params;
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold">Ne plus recevoir de relances</h1>
      <p className="mb-6 text-slate-600">Confirmez pour ne plus recevoir aucun message de relance de devis.</p>
      <form method="post" action={`/api/desinscription/${prospectId}/${token}`}>
        <button className="btn">Me désinscrire</button>
      </form>
    </main>
  );
}
