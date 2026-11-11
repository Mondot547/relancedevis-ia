export const metadata = { title: "Désinscription confirmée", robots: { index: false } };

export default function Confirmation() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold">C'est fait</h1>
      <p className="text-slate-600">Vous ne recevrez plus de relances de devis.</p>
    </main>
  );
}
