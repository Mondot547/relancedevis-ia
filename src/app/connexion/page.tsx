import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { Banner } from "@/components/Banner";

export const metadata = { title: "Connexion — RelanceDevis AI" };

export default async function Connexion({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Connexion</h1>
      <Banner erreur={sp.erreur} info={sp.info} />
      <form action={signIn} className="card space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" required autoComplete="current-password" /></div>
        <button className="btn w-full">Se connecter</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/mot-de-passe-oublie" className="text-indigo-700">Mot de passe oublié ?</Link> ·{" "}
        <Link href="/inscription" className="text-indigo-700">Créer un compte</Link>
      </p>
    </main>
  );
}
