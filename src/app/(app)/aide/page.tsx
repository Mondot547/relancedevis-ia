export const metadata = { title: "Aide — RelanceDevis AI" };

const FAQ: [string, string][] = [
  ["Comment fonctionnent les relances ?", "Quand vous ajoutez un devis « envoyé », la campagne de relance se programme automatiquement selon vos délais (Paramètres)."],
  ["Quand les relances s'arrêtent-elles ?", "Dès que le devis est accepté ou refusé, que vous indiquez que le client a répondu, ou si vous suspendez la campagne."],
  ["Puis-je changer les délais ?", "Oui, dans Paramètres. Le changement s'applique aux prochains devis."],
  ["Un client ne veut plus être relancé ?", "Chaque relance comportera un lien de désinscription ; le client concerné ne recevra plus aucun message."],
];

export default function Aide() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Aide et assistance</h1>
      <div className="max-w-2xl space-y-4">
        {FAQ.map(([q, a]) => (
          <div key={q} className="card"><h2 className="font-semibold">{q}</h2><p className="mt-1 text-sm text-slate-600">{a}</p></div>
        ))}
      </div>
    </>
  );
}
