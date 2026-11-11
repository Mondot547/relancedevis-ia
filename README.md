# RelanceDevis AI

SaaS de relance automatique de devis pour artisans du bâtiment. Voir `ARCHITECTURE.md`.

## État

- Fait et testé : moteur de relance (`npm test`, 12 tests).
- Migrations SQL appliquées au projet Supabase `relancedevis` (région Paris, offre gratuite) et testées : isolation entre entreprises (RLS), anti-doublon, arrêt des relances après réponse ou désinscription.
- À construire : interface Next.js, authentification, Stripe, emails, déploiement.

## Démarrer dans GitHub Codespaces (depuis une tablette)

1. Créez un dépôt GitHub **privé** et téléversez le contenu de ce dossier (Add file → Upload files).
2. Sur la page du dépôt : bouton **Code** → onglet **Codespaces** → **Create codespace**.
3. À l'ouverture, `npm install` se lance seul. Dans le terminal : `npm test`.
4. Copiez `.env.example` en `.env.local` et renseignez vos clés (jamais dans GitHub).
