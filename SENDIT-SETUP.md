# WAGWAN × SENDIT — SETUP COMPLET

Cette version ajoute le suivi Sendit à l'Admin WAGWAN tout en conservant le frontend HTML/CSS/JS, Supabase, WhatsApp et l'email déjà présents.

## 1. SQL
Dans Supabase > SQL Editor, exécute :

`supabase/sendit-migration.sql`

Cela crée `delivery_shipments` et `delivery_tracking_events`.

## 2. Secrets Supabase
Supabase > Edge Functions > Secrets :

- `SENDIT_PUBLIC_KEY` = ta clé publique Sendit
- `SENDIT_SECRET_KEY` = ta clé privée/secrète Sendit
- `SENDIT_WEBHOOK_SIGNING_KEY` = la clé API associée au webhook Sendit que tu sélectionnes dans l'interface Sendit
- `SENDIT_BASE_URL` = `https://app.sendit.ma/api/v1` (optionnel)

Ne mets JAMAIS ces clés dans GitHub, HTML, JS ou le chat.

## 3. Déployer les Edge Functions
Déploie :

- `sendit-create-delivery`
- `sendit-districts`
- `sendit-pickup-cities`
- `sendit-packagings`
- `sendit-refresh-delivery`
- `sendit-webhook`

Le webhook `sendit-webhook` doit avoir **Verify JWT = OFF**. Les cinq autres restent protégées par JWT.

## 4. URL à mettre dans Sendit
Dans Sendit > API > Intégration Webhook :

`https://pjxdaiqnvunjaasmmten.supabase.co/functions/v1/sendit-webhook`

Événement : **Mise à jour du statut du colis**.

Sélectionne la clé API utilisée pour signer le webhook. La valeur secrète correspondante doit être placée dans `SENDIT_WEBHOOK_SIGNING_KEY`.

## 5. Comment ça fonctionne

1. Client commande → `PENDING` WAGWAN.
2. Client confirme WhatsApp → `CONFIRMED`.
3. Dans Admin > Order → `CRÉER EXPÉDITION SENDIT`.
4. Sélectionne le district Sendit exact du client, la ville de ramassage et l'emballage.
5. WAGWAN appelle `POST /deliveries` côté serveur.
6. Le code Sendit et `labelUrl` sont sauvegardés.
7. Sendit envoie les changements à `sendit-webhook`.
8. Le webhook vérifie `X-Sendit-Signature` en HMAC-SHA256 avant toute modification.
9. L'Admin affiche automatiquement : Colis créé → Ramassé → En transit → Agence → En livraison → Livré.

## 6. IMPORTANT — district client
Sendit demande un `district_id`, pas seulement une ville. L'Admin charge donc les districts correspondant à la ville de la commande et te laisse choisir le quartier exact.

## 7. IMPORTANT — ramassage
`pickup_district_id` correspond à la zone où WAGWAN remet les colis à Sendit. Ne suppose pas que c'est Casablanca : sélectionne la ville de ramassage réelle dans le modal.

## 8. Test conseillé
Crée une commande de test avec un vrai email et un téléphone de test. Confirme-la avec WhatsApp. Dans Admin, crée ensuite une expédition Sendit.

Vérifie :
- code Sendit dans la commande ;
- étiquette ;
- statut PENDING ;
- réception d'un webhook signé ;
- mise à jour automatique de `delivery_shipments` ;
- affichage du statut dans Admin.

## 9. Ne teste pas avec une vraie commande si tu ne veux pas consommer du stock
Le système WAGWAN actuel décrémente le stock à la création de la commande. Utilise donc un produit avec suffisamment de stock pour les tests.


## 10. Statut de connexion en direct dans Settings

Cette version ajoute la fonction `sendit-connection-status`. Elle vérifie côté serveur les secrets Sendit, demande un token via `/login`, puis effectue uniquement une lecture `GET /districts?page=1` avec ce token. Elle ne crée aucune expédition. L’Admin affiche `CONNECTED` uniquement si les deux étapes répondent correctement, sinon `NOT CONNECTED`; la vérification est relancée toutes les 45 secondes lorsque Settings est ouvert.

Déploie la nouvelle fonction depuis la racine du projet :

```bash
supabase functions deploy sendit-connection-status
```

Vérifie que les secrets `SENDIT_PUBLIC_KEY`, `SENDIT_SECRET_KEY` et, si nécessaire, `SENDIT_BASE_URL` sont déjà définis dans Supabase > Edge Functions > Secrets. La fonction utilise aussi les secrets système `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` et exige une session d’administrateur valide. Ne place aucune clé Sendit dans le frontend. Aucun changement SQL n’est requis pour ce statut.
