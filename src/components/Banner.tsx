export function Banner({ erreur, info }: { erreur?: string; info?: string }) {
  if (erreur) {
    return <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{erreur}</p>;
  }
  if (info) {
    return <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>;
  }
  return null;
}
