import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { Banner } from "@/components/Banner";

export default async function MotDePasseOublie({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Mot de passe oublié</h1>
      <Banner erreur={sp.erreur} />
      <form action={requestPasswordReset} className="card space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
        <button className="btn w-full">Envoyer le lien</button>
      </form>
      <p className="mt-4 text-center text-sm"><Link href="/connexion" className="text-indigo-700">Retour à la connexion</Link></p>
    </main>
  );
}
