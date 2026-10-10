# WAGWAN Next Drop / Register — déploiement

Cette fonctionnalité est additive. Elle ne supprime pas de tables ni d'inscriptions existantes.

## 1. Migration Supabase

Dans Supabase Dashboard → SQL Editor, exécute une seule fois le fichier :

`supabase/drop-launch-register-migration.sql`

La migration ajoute les champs de configuration du drop, crée `wagwan_drops` et `wagwan_drop_registrations`, protège les inscriptions par RLS et crée la fonction RPC publique `wagwan_register_for_drop`. Les visiteurs ne peuvent pas lire la liste des inscriptions ; seul un administrateur autorisé peut consulter, modifier l'état lu ou supprimer une inscription.

## 2. Déploiement frontend

Publie les fichiers du projet sur Cloudflare Pages comme d'habitude. Le nouveau fichier `drop-launch.js` est chargé depuis `index.html`.

Aucune Edge Function supplémentaire ni clé `service_role` n'est nécessaire : l'inscription publique passe par une fonction SQL `SECURITY DEFINER` validée côté serveur.

## 3. Activation

Connecte-toi à `admin/index.html`, puis ouvre Settings → Drop Launch Settings :
- renseigne le nom, la date et l'heure ;
- conserve `Africa/Casablanca` pour le fuseau marocain ;
- règle l'état des inscriptions ;
- active « Mode prochain drop » et sauvegarde.

Le menu `Register`, juste au-dessus de Settings, affiche les inscriptions. Les nouvelles inscriptions augmentent son badge ; le badge est marqué comme lu quand l'administrateur ouvre Register. La liste se rafraîchit par Realtime si disponible et sinon par polling périodique.

## 4. Comportement du lancement

Quand le compte à rebours atteint zéro, il reste à zéro. Si la fermeture automatique est activée, le formulaire est fermé et le RPC refuse toute nouvelle inscription après l'heure de lancement. Le mode boutique ne se désactive jamais automatiquement : désactive « Mode prochain drop » manuellement dans Settings pour réafficher la boutique normale.

Si tu changes le nom ou la date/heure du drop, le système crée un nouvel enregistrement de drop et conserve les inscriptions précédentes. Une simple modification du statut d'inscription met à jour le drop actuel.

## 5. Tests à faire après déploiement

Tester en premier sur un environnement de préproduction ou après sauvegarde :
1. Activer le mode et vérifier la page de préinscription publique.
2. S'inscrire avec un téléphone valide, puis vérifier Register.
3. Réessayer le même numéro pour le même drop : il doit être reconnu comme déjà inscrit.
4. Essayer un numéro invalide.
5. Vérifier le badge Register et la suppression avec confirmation.
6. Désactiver le mode et vérifier que la boutique normale revient.
7. Modifier le drop et confirmer que les anciennes inscriptions restent dans la liste.
