import Link from "next/link";
import { requireContext } from "@/lib/context";
import { signOut } from "@/app/auth/actions";

const NAV = [
  ["Tableau de bord", "/tableau-de-bord"],
  ["Prospects", "/prospects"],
  ["Devis", "/devis"],
  ["Relances", "/relances"],
  ["Paramètres", "/parametres"],
  ["Facturation", "/facturation"],
  ["Aide", "/aide"],
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, orgId } = await requireContext();
  const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-bold text-indigo-700">RelanceDevis AI</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{org?.name}</span>
            <form action={signOut}><button className="btn-secondary">Déconnexion</button></form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
