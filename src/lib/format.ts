const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const euro = (cents: number | null | undefined) => eur.format((cents ?? 0) / 100);

export const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—";

export const dateTimeFr = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })
    : "—";

export const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-100 text-slate-700" },
  sent: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "Accepté", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Refusé", cls: "bg-rose-100 text-rose-800" },
  expired: { label: "Expiré", cls: "bg-slate-100 text-slate-700" },
};

export const FOLLOWUP_STATUS: Record<string, string> = {
  scheduled: "Programmée",
  processing: "En cours",
  sent: "Envoyée",
  failed: "Échec (nouvelle tentative)",
  cancelled: "Annulée",
  skipped: "Ignorée (date passée)",
};
