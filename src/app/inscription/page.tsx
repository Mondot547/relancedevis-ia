import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { Banner } from "@/components/Banner";

export const metadata = { title: "Inscription — RelanceDevis AI" };

export default async function Inscription({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Créer mon compte</h1>
      <Banner erreur={sp.erreur} />
      <form action={signUp} className="card space-y-4">
        <div><label className="label" htmlFor="full_name">Votre nom</label><input className="input" id="full_name" name="full_name" required autoComplete="name" /></div>
        <div><label className="label" htmlFor="company_name">Nom de l'entreprise</label><input className="input" id="company_name" name="company_name" required autoComplete="organization" /></div>
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Mot de passe (8 caractères minimum)</label><input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="cgu" required className="mt-1" />
          <span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span>
        </label>
        <button className="btn w-full">Créer mon compte</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Déjà inscrit ? <Link href="/connexion" className="text-indigo-700">Se connecter</Link>
      </p>
    </main>
  );
}
