import Link from "next/link";
import { Plans } from "@/components/Plans";

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold text-indigo-700">RelanceDevis AI</span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/tarifs" className="text-slate-600 hover:text-slate-900">Tarifs</Link>
          <Link href="/connexion" className="btn-secondary">Connexion</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Ne perdez plus un chantier faute de relance
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          RelanceDevis AI relance vos devis à votre place, au bon moment, avec des messages professionnels.
          Vous gardez le contrôle : la relance s'arrête dès que le client répond.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/inscription" className="btn px-6 py-3">Créer mon compte</Link>
          <Link href="/tarifs" className="btn-secondary px-6 py-3">Voir les tarifs</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-3">
        {[
          ["Relances automatiques", "Choisissez vos délais (par exemple J+3, J+7, J+14). Les envois respectent vos horaires de travail."],
          ["Zéro relance de trop", "Devis accepté, refusé ou client qui a répondu : plus aucun message n'est envoyé."],
          ["Tout suivre d'un coup d'œil", "Devis en attente, montants en jeu, taux de conversion : votre tableau de bord reste simple."],
        ].map(([t, d]) => (
          <div key={t} className="card"><h3 className="font-semibold">{t}</h3><p className="mt-2 text-sm text-slate-600">{d}</p></div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-8 text-center text-2xl font-bold">Des tarifs simples</h2>
        <Plans />
      </section>
    </main>
  );
}
