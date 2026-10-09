# WAGWAN V20 — correction Number Promo Leads

Cette migration a été alignée sur la définition SQL réelle fournie pour la base active : `normalize_moroccan_phone(p_input text)`, `claim_welcome_discount(p_visitor_id text, p_phone text)`, `analytics_visitors.last_seen` et `welcome_discount_claims.updated_at`. Elle conserve les signatures des fonctions, ne supprime aucune table ni ligne, et n’émet aucun code promo automatiquement.

## Formats acceptés

`0612345678`, `612345678`, `+212612345678`, `212612345678`, `00212612345678`, `2120612345678`, `06 12 34 56 78`, ainsi que les formats équivalents en `07`. Tous sont normalisés sous la forme `2126XXXXXXXX` ou `2127XXXXXXXX`, sans signe `+`, comme dans la fonction existante. Les numéros invalides renvoient `NULL` et sont refusés par le RPC.

## Exécution

1. Supabase → SQL Editor → New query.
2. Exécuter intégralement `supabase/fix-promo-phone-normalization.sql`.
3. Lancer ensuite la requête de test commentée en bas du fichier, séparément.
4. Tester le vrai popup du site.

La migration suppose que les colonnes mentionnées dans la fonction live fournie (`last_seen`, `updated_at`, `status`, `order_id`, `lead_type`, `last_activity_at`) sont bien celles de la base active. Elle ne doit pas être lancée sur une autre base sans comparer son schéma.
