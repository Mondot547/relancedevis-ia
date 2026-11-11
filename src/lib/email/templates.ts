import { renderTemplate } from "../followup/engine.ts";

const TEMPLATES: Record<number, { subject: string; body: string }> = {
  1: {
    subject: "Votre devis « {{devis}} »",
    body:
      "Bonjour {{prenom}},\n\nJe me permets de revenir vers vous au sujet de mon devis « {{devis}} » d'un montant de {{montant}}. " +
      "Avez-vous eu le temps de l'étudier ? Je reste à votre disposition pour toute question ou ajustement.\n\nBien cordialement,\n{{entreprise}}",
  },
  2: {
    subject: "Re : votre devis « {{devis}} »",
    body:
      "Bonjour {{prenom}},\n\nJe reviens vers vous concernant le devis « {{devis}} ». Si certains points méritent d'être précisés " +
      "(délais, matériaux, budget), n'hésitez pas à me répondre : je peux adapter ma proposition.\n\nBien cordialement,\n{{entreprise}}",
  },
  3: {
    subject: "Dernier message concernant votre devis « {{devis}} »",
    body:
      "Bonjour {{prenom}},\n\nSans nouvelle de votre part, je me permets un dernier message au sujet du devis « {{devis}} ». " +
      "Si votre projet est toujours d'actualité, je serai ravi d'en discuter. Dans le cas contraire, je ne vous relancerai plus.\n\nBien cordialement,\n{{entreprise}}",
  },
};

export interface EmailInput {
  step: number;
  prospectName: string;
  quoteTitle: string;
  amountCents: number;
  companyName: string;
  unsubscribePageUrl: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildEmail(i: EmailInput): { subject: string; text: string; html: string } {
  const tpl = TEMPLATES[Math.min(Math.max(i.step, 1), 3)];
  const vars = {
    prenom: i.prospectName.trim().split(/\s+/)[0] ?? "",
    devis: i.quoteTitle,
    montant: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(i.amountCents / 100),
    entreprise: i.companyName,
  };
  const subject = renderTemplate(tpl.subject, vars).replace(/[\r\n]+/g, " ");
  const body = renderTemplate(tpl.body, vars);
  const footer = `Vous ne souhaitez plus recevoir de relances de ${i.companyName} ? Se désinscrire : ${i.unsubscribePageUrl}`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">` +
    body.split("\n\n").map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") +
    `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">` +
    `<p style="font-size:12px;color:#666">Vous ne souhaitez plus recevoir de relances de ${escapeHtml(i.companyName)} ? ` +
    `<a href="${escapeHtml(i.unsubscribePageUrl)}">Se désinscrire</a></p></div>`;

  return { subject, text: `${body}\n\n--\n${footer}`, html };
}
