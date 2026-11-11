# RelanceDevis AI — Architecture (budget < 100 €)

## Stack et coûts

| Brique | Choix | Coût de départ |
|---|---|---|
| Front + API | Next.js (TypeScript, Tailwind) sur Cloudflare Workers/Pages (`@opennextjs/cloudflare`) | 0 € (offre gratuite) |
| Base + Auth + RLS | Supabase (offre gratuite) | 0 € (pause après 1 semaine d'inactivité ; passer à ~25 $/mois avant les premiers clients payants pour les sauvegardes quotidiennes) |
| Emails | Resend (3 000 emails/mois gratuits, 100/jour) | 0 € |
| Paiements | Stripe | 0 € fixe, ~1,5 % + 0,25 € par paiement européen |
| Code | GitHub (dépôt privé) | 0 € |
| Domaine | .fr / .com | ~10 €/an (à valider avec vous) |
| IA (facultatif) | Appel API uniquement à la demande, modèle économique, plafonné par organisation | quelques euros/mois |
| Cron | Cloudflare Cron Triggers (toutes les 5 min) | 0 € |

Budget de lancement : ~10 € (domaine). Le poste à anticiper est Supabase Pro (≈ 25 $/mois) dès les premiers clients, pour les sauvegardes.

## Flux

1. Inscription Supabase Auth → trigger `handle_new_user` crée profil + entreprise + rôle owner.
2. Devis marqué « envoyé » → `planFollowUps()` calcule les relances (J+3/7/14 configurables, calées sur la fenêtre d'envoi) → lignes `follow_up_logs` (unique `campaign_id, step`).
3. Cron (5 min) → Worker appelle `claim_due_followups()` (`FOR UPDATE SKIP LOCKED`) → `decideSend()` (dernier contrôle) → Resend → log.
4. Réponse / acceptation / refus → trigger SQL `on_quote_closed` annule les relances en attente.
5. Stripe webhook (signature vérifiée, idempotence via `stripe_events`) → met à jour `subscriptions`.
6. Échec d'envoi → nouvelle tentative (15 min, 1 h, 4 h), puis abandon + notification.

## Sécurité

- RLS sur toutes les tables ; isolation par `organization_id` via `is_member()`.
- Écritures sensibles (abonnement, relances, audit) réservées au `service_role`, jamais exposé au navigateur.
- Secrets uniquement dans les variables d'environnement Cloudflare/Supabase (`.env.example` fourni, `.env*` ignoré par git).
- Lien de désinscription dans chaque relance + `prospects.email_opt_out`.
- Message IA : jamais envoyé sans validation si `ai_requires_validation` est actif (testé).

## Conformité (à faire valider par un juriste avant la mise en production)

Les relances concernent un devis demandé par la personne : c'est du suivi de relation existante, mais restez prudent pour les particuliers (opposition facile, pas de relances excessives, mention de l'expéditeur). CGU, CGV, politique de confidentialité, registre de traitement et DPA Supabase/Resend/Stripe restent à rédiger/valider.
