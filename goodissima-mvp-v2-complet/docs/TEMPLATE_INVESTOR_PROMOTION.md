# Promotion du template investisseur

Ce document decrit la promotion du template global `INVESTOR_INTRODUCTION` depuis le referentiel dev/local vers la production Goodissima.

## Source identifiee

Le template existant cote dev/local est le template applicatif global :

- `RelationTemplate.key` : `INVESTOR_INTRODUCTION`
- Nom : `Investor Introduction`
- Description : `Secure relationship entry point for investors and strategic partners.`
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

- `name`, texte requis, etape 1 ;
- `organization`, texte optionnel, etape 1 ;
- `role`, texte optionnel, etape 1 ;
- `country`, texte optionnel, etape 1 ;
- `interestType`, select requis, etape 2 ;
- `message`, textarea requis, etape 2 ;
- `notificationOptIn`, checkbox optionnelle, etape 3 ;
- `notificationEmail`, email conditionnel, affiche et requis si `notificationOptIn=true`, etape 3.

## Script

Script prepare :

```powershell
scripts/promote-investor-template-prod.mjs
```

Commande production recommandee :

```powershell
npx.cmd dotenv -e .env.production -- npx.cmd cross-env CONFIRM_PROD_TEMPLATE_IMPORT=true node scripts/promote-investor-template-prod.mjs
```

Alternative Windows sans `cross-env` :

```powershell
$env:CONFIRM_PROD_TEMPLATE_IMPORT="true"
npx.cmd dotenv -e .env.production -- node scripts/promote-investor-template-prod.mjs
```

## Garde-fous

Le script :

- affiche `GOODISSIMA_ENV`, `NODE_ENV` et la cible base de donnees sans secret ;
- refuse l'execution sans `CONFIRM_PROD_TEMPLATE_IMPORT=true` ;
- refuse aussi un environnement non-production sans confirmation explicite ;
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
node --check scripts/promote-investor-template-prod.mjs
npm.cmd run build
```

Ne pas lancer la commande d'import production sans validation humaine explicite.
