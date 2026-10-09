# WAGWAN V20 — audit du package et parcours client

## Ce qui a été corrigé dans ce package

1. **Number Promo Leads** : la migration utilise les noms de paramètres et colonnes de la fonction SQL active fournie (`p_input`, `last_seen`) et normalise les numéros marocains avant l’enregistrement. Elle garde le workflow du code manuel.
2. **Récompense photo** : l’édition générique d’un avis photo ne peut plus modifier directement son statut pour contourner la fonction de modération sécurisée. Le téléphone n’est modifiable via cette action que si l’avis est encore en attente.
3. **Points photo** : la fonction de modération sérialise les récompenses par compte et vérifie si ce compte a déjà une récompense photo, même si son numéro a changé.
4. **Contrôle technique effectué** : `node --check` a réussi pour `app.js`, `wagwan-v12.js`, `wagwan-growth-pack.js`, `sendit-admin.js`, `supabase-config.js` et `supabase-runtime.js`. Cela valide la syntaxe JavaScript uniquement, pas les appels réels à Supabase, WhatsApp, Resend ou Sendit.

## Parcours complet d’un client X

### 1. Arrivée sur le site
- Le client voit la page d’accueil WAGWAN, la navigation et les visuels de la marque.
- Sur mobile, l’en-tête utilise la navigation compacte ; sur ordinateur, la navigation complète est affichée.
- Les visites et certains événements sont suivis pour les analytics lorsque le navigateur et la connexion au backend le permettent.

### 2. Découverte et achat
- Il peut aller dans SHOP, ouvrir une fiche produit, consulter les images, choisir une taille (S, M, L ou XL selon le stock configuré), ajuster la quantité et ajouter au panier.
- Une taille sans stock doit être bloquée par l’interface. Le backend doit également revalider stock et prix au moment de créer la commande.
- Dans le panier, il peut modifier les quantités, retirer des articles et continuer vers le checkout.
- Le checkout demande les informations nécessaires à la livraison, notamment nom, téléphone, adresse et ville, avec email si activé.
- La commande est passée en paiement à la livraison (COD). Le résultat final dépend de la disponibilité de la fonction SQL `create_cod_order` et de son schéma exact dans la base active.

### 3. Promo et paniers abandonnés
- Le client peut saisir son numéro dans le popup promo. Les formats marocains locaux/internationaux listés dans le guide sont normalisés. Le système indique `manual_code: true` : cette fonctionnalité n’émet pas automatiquement un coupon par cette fonction.
- Les paniers anonymes, les Checkout Leads et les Number Promo Leads apparaissent dans leurs sections administrateur si les tables, policies et RPC correspondantes sont déployées.
- Le suivi des abandons dépend aussi des événements réellement envoyés par le navigateur et des statuts enregistrés dans Supabase.

### 4. Avis et communauté
- Le client peut envoyer un avis/feedback ; les nouveaux avis écrits sont en attente de validation avant affichage public.
- Dans **PARTAGEZ VOTRE OUTFIT**, il peut fournir son nom, un numéro de fidélité facultatif, choisir le produit et envoyer une photo JPG/PNG/WEBP de 5 Mo maximum.
- La photo reste en attente. Si l’administrateur la refuse, elle ne donne pas de points. Si elle est approuvée et qu’un compte de fidélité correspondant existe, la fonction sécurisée peut attribuer 5 points une seule fois par compte.
- Seules les photos approuvées sont prévues dans la galerie publique.

### 5. Fidélité
- Le principe configuré est 5 points par commande livrée et 5 points photo après approbation, selon les migrations déployées.
- Les points peuvent être consultés/utilisés si le RPC de solde, le checkout et les tables de fidélité actifs sont alignés. La sécurité d’identité du téléphone doit être considérée séparément : un numéro saisi seul n’est pas une preuve d’identité.

### 6. Suivi et contact
- Le client peut consulter les pages de suivi de commande si les données correspondantes existent.
- Le flux d’emails, WhatsApp et Sendit dépend des Edge Functions, secrets, templates, webhooks et validations de comptes configurés côté fournisseurs. Le package statique seul ne peut pas confirmer leur état de fonctionnement.

## Fonctions administrateur présentes dans le package

- Connexion admin via Supabase Auth et contrôle de rôle.
- Gestion des produits, catégories, images, tailles et stocks.
- Gestion/consultation des commandes, changement de statut et impression de reçu.
- Feedbacks et modération des photos d’outfit.
- Analytics, coupons, fidélité, paniers abandonnés et leads.
- Paramètres de croissance, liste d’attente des tailles, affiliés et données de risque COD selon les migrations correspondantes.
- Panneau Sendit si les Edge Functions et identifiants sont configurés.

## À faire avant de déclarer le site 100 % vérifié

- Exécuter `supabase/fix-promo-phone-normalization.sql` dans le projet Supabase actif puis vérifier le tableau de formats.
- Exécuter les migrations nécessaires une par une en comparant le schéma live ; ne pas rejouer aveuglément toutes les migrations historiques sur une base déjà modifiée.
- Tester en conditions réelles une commande COD, un stock à zéro, une annulation et le rétablissement du stock, les récompenses livrées, la modération photo, les trois catégories de leads, la connexion admin et chaque fournisseur externe.
- Vérifier la configuration du bucket `review-photos` et les politiques RLS de `wagwan_photo_reviews`.
- Ne jamais publier une clé Supabase `service_role`, un token Meta, une clé Resend ou un secret Sendit dans les fichiers frontend.

**Limite de vérification :** le ZIP a été inspecté et les contrôles de syntaxe JavaScript ont réussi. Je n’ai pas accès à une session connectée à la base Supabase active ni aux comptes fournisseurs ; je ne peux donc pas affirmer que tous les flux réseau et toutes les migrations fonctionneront sans test d’intégration.
