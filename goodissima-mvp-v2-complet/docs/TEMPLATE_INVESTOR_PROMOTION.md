# Promotion du template investisseur

Ce document decrit la promotion du template global `INVESTOR_INTRODUCTION` depuis le referentiel dev/local vers staging ou production Goodissima.

## Source identifiee

Le template existant cote dev/local est le template applicatif global :

- `RelationTemplate.key` : `INVESTOR_INTRODUCTION`
- Nom : `Introduction investisseur`
- Description : `Parcours de qualification sécurisé pour investisseurs et partenaires stratégiques.`
- Statut cible : `PUBLISHED`
- Form template : `INVESTOR_INTRODUCTION_FORM`
- Version active cible : version publiee construite depuis la structure importee

La structure promue contient uniquement le referentiel de parcours :

- `RelationTemplate`
- `FormTemplate`
- `FormField`
- `TemplateVersion`
- `RelationTemplate.aiInstructions`

Elle ne copie jamais :

- dossiers candidats ;
- messages ;
- documents ;
- liens securises existants ;
- actions relationnelles de dossiers.

Note : dans le schema actuel, les actions relationnelles sont portees par `RelationAction`, liee a `RelationCase`. Elles sont donc des donnees de dossier, pas des donnees de template, et restent exclues de cette promotion.

## Champs promus

Le parcours contient les champs suivants :

- `name` : Nom et prénom, texte requis, etape 1 ;
- `organization` : Organisation / Fonds d’investissement, texte optionnel, etape 1 ;
- `role` : Fonction, texte optionnel, etape 1 ;
- `country` : Pays, texte optionnel, etape 1 ;
- `interestType` : Nature de votre intérêt, select requis, etape 2 ;
- `message` : Présentez votre intérêt pour Goodissima, textarea requis, etape 2 ;
- `notificationOptIn` : Je souhaite être informé des mises à jour de cet échange sécurisé, checkbox optionnelle, etape 3 ;
- `notificationEmail` : Adresse email de notification, email conditionnel, affiche et requis si `notificationOptIn=true`, etape 3.

## Script

Script prepare :

```powershell
scripts/promote-investor-template.mjs
```

Commande staging :

```powershell
npx dotenv -e .env.staging -- node scripts/promote-investor-template.mjs
```

Commande production :

```powershell
npx dotenv -e .env.production -- node scripts/promote-investor-template.mjs
```

Equivalent Windows explicite :

```powershell
npx.cmd dotenv -e .env.staging -- node scripts/promote-investor-template.mjs
npx.cmd dotenv -e .env.production -- node scripts/promote-investor-template.mjs
```

Execution locale/dev volontaire :

```powershell
$env:CONFIRM_TEMPLATE_IMPORT="true"
npx.cmd dotenv -e .env.local -- node scripts/promote-investor-template.mjs
```

## Garde-fous

Le script :

- affiche `GOODISSIMA_ENV`, `NODE_ENV` et la cible base de donnees sans secret ;
- accepte `GOODISSIMA_ENV=staging` et `GOODISSIMA_ENV=production` ;
- refuse local/dev/indefini sans `CONFIRM_TEMPLATE_IMPORT=true` ;
- cree le template s'il n'existe pas ;
- met a jour le template s'il existe ;
- recree les champs du formulaire lie au template ;
- publie une version identique existante si elle existe deja ;
- cree une nouvelle version publiee uniquement si la structure a change ;
- depublie les anciennes versions du meme template ;
- controle que les compteurs `RelationCase`, `Message`, `Document` et `GLink` ne changent pas.

## Verification

Verification technique locale :

```powershell
node --check scripts/promote-investor-template.mjs
npm.cmd run build
```

Ne pas lancer la commande d'import production sans validation humaine explicite.
