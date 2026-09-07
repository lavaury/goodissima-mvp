# DEBT-AUTH-02 — Utilisation des templates et lecture des parcours

## Baseline et périmètre

Inspection du 2026-09-07, branche `hotfix/privacy-noindex-production`, HEAD `91185ea804262f9006aa517844e7d8fa08dd8729` (`fix(auth): enforce template ownership on mutations`). Typecheck initial à zéro ; aucun changement suivi ; seul `m1a/` non suivi. Aucun commit ni push dans cette intervention.

Ce lot sécurise USE pour créer un GLink et READ pour les collections/détails privés de parcours. Il ne crée aucun parcours libre, bouton, menu, modèle partagé ou mécanisme de migration. Les surfaces publiques/candidates restent gouvernées par leurs contrôles propres : le formulaire d'un lien déjà accessible n'est pas un droit d'ouvrir le cockpit de son template source.

## Phase A — audit avant modification

`RelationTemplate` n'a pas d'ownerId. `workspaceId` est nullable. Le modèle de version s'appelle réellement `TemplateVersion`, et non RelationTemplateVersion. `FormTemplate` fournit l'identifiant des pages `/templates/[templateId]` et `/gouvernance/parcours/[id]/pilotage` ; la création GLink reçoit un identifiant **RelationTemplate**. Ces deux identifiants ne sont pas interchangeables.

Preuves de création fiables déjà retenues par DEBT-AUTH-01 :

- Workspace présent : son propriétaire est prioritaire ; une ancienne provenance ne contourne pas un Workspace étranger. Référence Workspace manquante : refus.
- Sans Workspace : auteurs distincts des `TemplateGeneration` VALIDATED avec validatedAt non nul ; auteur de la version 1 uniquement lorsque `snapshot.metadata.source` vaut `governance-v1-minimal-create` et createdById est une chaîne non vide.
- Un seul créateur fiable, égal à l'utilisateur, est requis. Aucun créateur ou plusieurs créateurs : refus. Une modification ultérieure, un lien propriétaire, isDefault ou la visibilité d'un bouton ne constituent pas une preuve.
- Aucune capability générale de partage des RelationTemplate n'est établie par le schéma ou les flux audités. Les droits d'administration ou de confiance ne sont pas des droits template implicites.

### Matrice historique

« Global » désigne les catalogues/détails templates authentifiés avant correction. « Métadonnées » désigne le contrôle historique du cockpit, qui n'était pas identique à celui des listes ou mutations.

| Origine | READ actuel à la baseline | USE actuel à la baseline | MUTATE DEBT-AUTH-01 | Règle cible |
| --- | --- | --- | --- | --- |
| Workspace propriétaire | Oui | Oui, sans preuve USE spécifique | Preuve propriétaire, puis contraintes de l'action | READ oui ; USE hors archive ; MUTATE inchangé |
| Workspace étranger | Catalogues/détails globaux ; cockpit contournable par métadonnée propriétaire contradictoire | Possible par id | Refus | READ/USE refus, métadonnée sans effet |
| Sans Workspace, preuve fiable de création | Catalogues globaux ; cockpit/listes dépendants des métadonnées, génération validée non reconnue uniformément | Possible par id | Oui si créateur unique | READ oui ; USE hors archive |
| Sans Workspace, sans preuve | Catalogues/détails globaux | Possible par id | Refus | READ/USE refus |
| Preuves contradictoires sans Workspace | Pas de contrôle commun des contradictions | Possible par id | Refus | READ/USE refus |
| isDefault seul | Priorité d'affichage au catalogue | Aucun contrôle spécifique | N'accorde aucun droit | Aucun droit ajouté |
| Modèle système exact de conversation sécurisée | Visible globalement | Repli historique pour les créations sans sélection | Aucun droit sans propriétaire | Exception USE étroite, pas de cockpit READ ni de MUTATE implicites |
| Autre modèle dit partagé/public | Pas de marqueur de partage démontré | Ancienne visibilité globale insuffisante | Pas de partage implicite | Aucune exception inventée |

### Preuve de l'exception système

La migration `20260520003000_add_relation_engine_foundation` insère explicitement l'id `rel_tpl_default_secure_conversation`, clé `DEFAULT_SECURE_CONVERSATION`, et l'associe aux dossiers existants. `20260521170000_add_glink_relation_template` l'associe aux liens existants ; `20260521132000_add_dynamic_form_engine_foundation` crée son formulaire. Le helper historique `getRelationTemplateForLink` l'utilise comme repli commun sans sélection. Ce faisceau démontre la fonction système de ce modèle précis, pas une permission universelle liée à isDefault.

L'exception USE exige l'id ET la clé exacts, aucun Workspace, aucune provenance fiable personnelle et un statut non ARCHIVED. Si le seed manque, est archivé, est rattaché à B ou porte des preuves contradictoires, refus. Aucun enregistrement n'est créé/réattribué pour réparer un seed manquant. Aucun autre modèle seed/demo/default ne reçoit cette exception.

READ dans ce lot signifie l'accès propriétaire aux collections/détails et au cockpit. La présentation du formulaire système dans le catalogue de création est une projection limitée nécessaire à USE ; elle n'autorise pas son cockpit ou sa mutation.

### Cartographie des lectures

| Entrée | Baseline | Traitement |
| --- | --- | --- |
| `/links/new` | Tous les templates non archivés, tri isDefault/date, formulaire/champs/version publiée/politique de confiance ; non paginé ; templates internes possibles | Filtre USE avant lecture des données du catalogue ; aucune modification JSX |
| POST `/api/links` | Sélection par id, repli système même après id absent en base | Vérifie USE avant version, création, audit et email ; sélection explicite interdite/inconnue = 404, sans repli |
| `/templates`, alias `/parcours` | Liste globale authentifiée | Filtre READ |
| GET `/api/templates` | Liste globale authentifiée | Filtre READ ; POST manuel inchangé |
| `/templates/[templateId]` | Lecture par id sans propriété | Garde READ avant chargement du détail |
| Cockpit gouverné et repository de consolidation | Métadonnées dernière version OU propriétaire Workspace | Garde READ commune avant détail ; ancien OR retiré |
| Parcours sans Workspace dans Mes espaces | Source gouvernée sur une version, auteur dernière version filtré en mémoire | Filtre READ commun ; génération validée reconnue ; métadonnées récentes utilisées seulement pour la présentation |
| Workspace Explorer, arborescence et compteurs directs Workspace/Portfolio | Workspace/Portfolio filtré par owner, RelationTemplate directement rattaché | Déjà conforme à la priorité Workspace ; inchangé |
| Archives d'opportunités | Cohorte par génération ou lien propriétaire, sans preuve suffisante sur le template | Intersection de la cohorte existante avec READ ; formule de comptage inchangée |
| Compteur de brouillons `/opportunities` | Compteur global de RelationTemplate | Filtre READ ; aucun libellé ni autre cohorte modifié |
| Formulaire de lien propriétaire/public, cas candidat | Accès par objet/lien/token dans leur contexte | Inchangé ; ne donne pas accès au cockpit privé |
| Pilotage global/Portfolio, IA, invitations/média et autres actions métier | Contrôles et agrégations spécialisés | Hors périmètre ; aucune extension de capacité sur un parcours sans Workspace |

Le helper public historique conserve son comportement pour les liens/dossiers déjà autorisés. Son commentaire précise qu'il n'est pas une permission USE. L'API de création ne l'appelle plus.

## Contrats et implémentation

`lib/relation-template-access.ts` centralise READ et USE sans exporter de capability MUTATE. La preuve READ reproduit strictement la politique propriétaire de DEBT-AUTH-01 ; ce dernier service et ses handlers ne sont pas modifiés. Un test d'équivalence couvre A/B et toutes les provenances des fixtures, pour détecter une divergence future.

READ : propriétaire Workspace prioritaire, sinon créateur unique démontré. Objet inaccessible : notFound dans les pages, null dans le repository. Aucun détail métier chargé avant refus du cockpit/éditeur.

USE : READ propriétaire et statut non ARCHIVED, ou exception système exacte décrite ci-dessus. Les contraintes historiques de version/publication ne sont pas remplacées par une nouvelle politique de publication : les brouillons propriétaires restent utilisables comme dans le catalogue précédent. USE est revérifié sur chaque POST, indépendamment du formulaire. Paramètre explicite de type invalide/vide : 400. Template absent, étranger, sans preuve, contradictoire ou archivé : même 404 `Parcours introuvable.`. Aucune création sans template autorisé.

Le ownerId du GLink vient toujours de la session. Un id explicite invalide ne déclenche pas un repli vers un autre template. Le comportement d'email existant reste inchangé : le formulaire envoie suppressNotification:true ; un client qui l'omet conserve le comportement antérieur de l'API.

Les collections chargent en lot les candidats propriétaires : Workspace propriétaire, ou preuve initiale/génération de l'utilisateur, ou seed exact pour USE. Elles lisent aussi les preuves contradictoires avant de produire les ids autorisés. Pas d'appel d'autorisation par ligne. Les listes restent non paginées conformément au non-objectif ; ce lot n'est pas un chantier de performance. L'initial snapshot peut encore être volumineux. Aucun cache de droits transversal n'est introduit.

## Validation

- Typecheck initial et final : zéro diagnostic.
- Build : succès complet, **61/61 pages** ; avertissements de cache webpack non bloquants.
- Nouveau fichier `qa/relation-template-access.test.ts` : **40 tests réussis**. READ/USE A/B, cas TA/TB/TA0/TB0/inconnu/contradictoire, preuve initiale, isDefault, seed strict, refus sans effet, catalogues, garde des pages, consolidation, liste orpheline et intersection des archives. Les tests exécutent les modules/handler POST réels avec session/Prisma/services doublés.
- Non-régression DEBT-AUTH-01 et surfaces concernées : **256 réussis**, dont **43 tests de mutation A/B**. Refus 404, confirm:true sans effet sur les droits, copie dans une destination explicite propriétaire active et **409 historique sans destination** conservés.
- Total distinct de ces contrôles : **296 tests réussis** (256 + 40).
- Maintenance Boussole : **55 réussis**. EMPTY/POPULATED reflètent les objets désormais autorisés ; FOCUSED conserve le même objet/contrat. Aucun texte, ID, étape, ordre ou mécanisme Boussole modifié ; pas d'incrément journeyVersion.
- D-020 exécutée séparément : **8 réussis / 2 échecs historiques**, les deux assertions sur l'ancien Dashboard. Aucun test modifié, exclu ou masqué.

Commandes :

```sh
npm run typecheck
npm run build
node --experimental-strip-types --test qa/relation-template-access.test.ts
node --experimental-strip-types --test qa/template-mutation-access.test.ts qa/candidate-form-safety.test.ts qa/announcement-publication.test.ts qa/manual-journey-editor.test.ts qa/opportunity-domain.test.ts qa/workspace-detail.test.ts qa/workspace-creation.test.ts qa/workspace-portfolio-creation.test.ts qa/workspace-pilotage.test.ts qa/spaces.test.ts qa/portfolio-explorer.test.ts qa/dashboard-home.test.ts qa/dashboard-glink-polish.test.ts qa/connected-shell.test.ts qa/spatial-navigation.test.ts qa/governed-invitation-access.test.ts qa/feedback-url.test.ts qa/document-upload.test.ts qa/web-typecheck.test.ts
npm run qa:boussole-maintenance
node --experimental-strip-types --test qa/announcement-archive.test.ts qa/archived-opportunity-count.test.ts
git diff --check
git status --short
```

## Réserves et revue humaine

- Tests sans base réelle et sans recette navigateur A/B ; vérifier en Preview après un jalon explicitement autorisé.
- Les templates manuels anciens/nouveaux sans provenance fiable deviennent invisibles dans les collections privées et inutilisables pour créer un nouveau GLink. C'est le refus sûr demandé, pas une attribution historique. La création manuelle elle-même reste inchangée.
- Les templates techniques du builder simple sans preuve sont exclus du catalogue ; le lien et son formulaire public restent accessibles selon leur contrat propre.
- La création libre et les fonctions métier qui exigent encore un Workspace restent pour les lots ultérieurs. READ n'autorise aucune nouvelle invitation, opération IA, communication ou mutation.
- Le rattachement de parcours conserve son contrôle historique supplémentaire après DEBT-AUTH-01 : certaines provenances lisibles peuvent encore être refusées par cette mutation. Aucune garde MUTATE n'est assouplie.
- Aucun traitement de D-002, D-004, D-019, D-020, du rattachement dossier → lien, des agrégats de pilotage ou de la pagination. Les cohortes historiques d'archives restent inchangées en dehors de l'intersection de sécurité. D-015 n'est pas clôturée.
- Pas de nouvelle politique de verrouillage concurrent ni de migration. Les permissions sont vérifiées côté serveur à chaque entrée ; les changements historiques de propriété hors application demandent leur propre procédure d'intégrité.
- Aucune modification Prisma, migration, JSX, navigation, menu, libellé ou Boussole. `m1a/` reste hors périmètre.

15 fichiers dans le lot : 11 fichiers applicatifs existants, un service READ/USE, un fichier de tests, ce rapport et le registre. UTF-8 et diff contrôlés avant remise. Aucun commit ni push ; modifications laissées pour revue humaine.

## Jalon de revue finale et commit

Revue humaine du diff suivie du jalon autorisé : `fix(auth): enforce template read and use access`. Les mentions de non-commit ci-dessus décrivent la phase initiale d’implémentation. La revue finale ajoute un test négatif (40 au lieu de 39) couvrant l’id système exact avec une mauvaise clé, ou une provenance personnelle de B : READ/USE/MUTATE refusés pour A. Le contrat applicatif reste inchangé.

Statut du lot : **RESOLVED TECHNICALLY** ; recette en environnement réel toujours attendue. Le hash final est fourni dans le compte rendu après création. Convention identique au jalon DEBT-AUTH-01 : un commit ne contient pas son propre hash final ; son enregistrement dans ce rapport/registre attendra une mise à jour ultérieure autorisée. Aucun hash anticipé, amend, second commit ou push dans ce jalon.
