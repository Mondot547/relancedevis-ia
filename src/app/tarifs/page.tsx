import Link from "next/link";
import { Plans } from "@/components/Plans";

export const metadata = { title: "Tarifs — RelanceDevis AI" };

export default function Tarifs() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/" className="text-sm text-indigo-700">← Accueil</Link>
      <h1 className="mt-4 text-center text-3xl font-bold">Tarifs</h1>
      <p className="mb-10 mt-2 text-center text-slate-600">Abonnement mensuel ou annuel, résiliable à tout moment.</p>
      <Plans />
    </main>
  );
}
