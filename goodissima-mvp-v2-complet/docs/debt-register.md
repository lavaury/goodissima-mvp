# Registre des dettes Goodissima

Source persistante issue de l'audit TECH/UX-DEBT-01, consolidée le 2026-09-07.
Baseline : `9ea80e9bb5c79e989b409d1dbe679dae926360fb`.
Date d'enregistrement et dernière vérification : **2026-09-07** pour toutes les entrées.
Cette date n'est pas une date d'introduction : les historiques exacts non établis restent inconnus.

`OPEN` : dette conservée. `DEFERRED` : report/arbitrage produit explicite proposé par l'audit.
`RESOLVED TECHNICALLY / prêt à clôturer avec commit` : validation technique obtenue ; clôture du registre en attente de l'enregistrement du hash final.
`RESOLVED` est réservé à une clôture accompagnée du hash de résolution enregistré.
Pour **toutes** les entrées, hash de résolution enregistré : **aucun** à ce jour.
D-001/D-017 sont résolues techniquement le 2026-09-07, avec recette humaine du lot encore attendue.
Les autres entrées n'ont aucune date de résolution et ne sont pas corrigées par DEBT-TS-01.

| ID | Dette / catégorie | Priorité | Statut | Preuve et risque conservé | Lot envisagé |
| --- | --- | --- | --- | --- | --- |
| D-001 | FormData web pollué par React Native / configuration | P0 | RESOLVED TECHNICALLY / prêt à clôturer avec commit | `tsconfig.json` absorbait `m1a/.../goodissima-mobile/node_modules/react-native/src/types/globals.d.ts`. Trois erreurs `get` dans upload, cinq dans feedback. Type web restauré, aucune API modifiée. | DEBT-TS-01 |
| D-002 | AI-WORKSPACE-SCOPE / contrat de contexte | P1 | OPEN | `lib/governance-ai-actions.ts` ne transmet pas les identifiants Workspace/parcours ; `lib/governance-ai-context-repository.ts` conserve du contexte propriétaire global. Repli global possible si Portfolio absent. Isolation intra-propriétaire incomplète ; fuite inter-propriétaires non démontrée. | DEBT-AUTH-01 |
| D-003 | Archivage template sans contrôle propriétaire / autorisation | P0 | OPEN | `app/api/templates/[templateId]/archive/route.ts` authentifie puis lit par identifiant sans filtre propriétaire. Simulation du handler avec doubles : utilisateur A archive un template B. | DEBT-AUTH-01 |
| D-004 | Réactivation historique d'un Workspace par nom / intégrité | P1 | OPEN | `lib/governance-journey-actions.ts`, création de parcours : `upsert(ownerId_slug)` peut réactiver un Workspace archivé. Le Portfolio existant est conservé. La nouvelle création Workspace contextualisée ne présente pas ce comportement. | DEBT-DATA-QA-01 |
| D-005 | Slug Portfolio exposé / UX | P3 | OPEN | `components/PortfolioExplorerView.tsx`, Informations secondaires : identifiant technique visible alors que les destinations utilisent l'id. | DEBT-UX-01 |
| D-006 | « Workspace produit V1 » / UX | P2 | OPEN | `components/WorkspaceCreationForm.tsx` : formulation technique dans la création. | DEBT-UX-01 |
| D-007 | Bannière V1 et évolution future / UX | P2 | OPEN | Surface de création Workspace : explications de version/implémentation à requalifier pour l'utilisateur. | DEBT-UX-01 |
| D-008 | « Rubrique produit » / UX et données | P2 | OPEN | Catégorie persistée du Workspace, validée côté serveur avec repli OTHER ; également utilisée dans les métadonnées de rattachement. Ne pas supprimer la donnée par simple retrait du libellé. | DEBT-UX-01 |
| D-009 | « Type d'usage » / UX et données | P2 | OPEN | Kind GOVERNANCE/RELATION/MIXED persisté. Clarifier le sens ; aucun contrôle d'autorisation fondé sur ce champ établi par l'audit. | DEBT-UX-01 |
| D-010 | Badges Workspace techniques / UX | P2 | OPEN | `components/WorkspaceDetailView.tsx` : catégorie, kind et statut, notamment Autre/Gouvernance/Actif. | DEBT-UX-01 |
| D-011 | Densité des listes / UX | P3 | DEFERRED | Effet dépendant des volumes réels ; mesurer en recette avant densification. | DEBT-UX-01 |
| D-012 | Texte Mes espaces dense / UX | P3 | OPEN | Simplification possible, en préservant le sens du contrôle humain. | DEBT-UX-01 |
| D-013 | Sous-titre activité récente / UX | P3 | DEFERRED | `components/DashboardHome.tsx` : « Quelques créations et dépôts récents ». Présence confirmée ; caractère problématique non démontré, la liste étant volontairement partielle. | DEBT-UX-01 |
| D-014 | Répétition « Paris » dans les dates / UX | P3 | OPEN | `components/DashboardHome.tsx` : fuseau correct, répétition visuelle à arbitrer sans modifier les dates réelles. | DEBT-UX-01 |
| D-015 | Agrégats et cohortes hétérogènes / données | P1 | OPEN | Accueil neutralisé par UX-01D.1. `/opportunities` conserve notamment un compteur de brouillons sans owner et des libellés/cohortes hétérogènes. Le retrait des KPI Accueil ne résout pas toute la dette. | DEBT-DATA-QA-01 |
| D-016 | Politique Administration/capabilities / accès | P2 | OPEN | Entrée Administration visible aux connectés ; `docs/ADMIN_ACCESS.md` décrit l'accès aux coûts propres. Feedback et Champagne ont leurs contrôles de rôles distincts. Aucune absence générale de garde API démontrée : décision de politique requise. | DEBT-AUTH-01 |
| D-017 | Périmètre TypeScript global pollué / configuration | P0 | RESOLVED TECHNICALLY / prêt à clôturer avec commit | 696 diagnostics reproduits, 125 fichiers ; 686 dans m1a, 8 app dus aux types RN, 2 QA principaux. Périmètre borné, deux contrats corrigés, commande officielle à zéro. Détail dans `debt-ts-01.md`. | DEBT-TS-01 |
| D-018 | Suppression/duplication template sans contrôle propriétaire / autorisation | P0 | OPEN | `app/api/templates/[templateId]/route.ts` DELETE et route `duplicate` : recherche par id après authentification sans contrôle propriétaire. Simulation de suppression d'un brouillon étranger inutilisé : deux suppressions acceptées. | DEBT-AUTH-01 |
| D-019 | Destination IA protocole relatif / navigation | P1 | OPEN | `lib/governance-ai-assistant.ts` accepte `url.startsWith("/")`, donc `//example.invalid`. Le clic peut sortir du site ; aucune navigation automatique constatée. | DEBT-AUTH-01 |
| D-020 | Deux assertions QA obsolètes après Accueil simplifié / tests | P1 | OPEN | `qa/announcement-archive.test.ts` et `qa/archived-opportunity-count.test.ts` exigent encore l'ancien compteur Dashboard. Deux échecs reproduits ; aucune correction dans ce lot. | DEBT-DATA-QA-01 |

## Preuves de résolution D-001 / D-017

- Commande de référence : `npm run typecheck`, TypeScript 5.9.3, Node v24.14.1.
- Résultat : **0 diagnostic**, `strict: true`, `noEmit: true`, sans `ignoreBuildErrors`.
- Build complet : `npm run build`, succès (moteur, Prisma Client, compilation Next, typage, 61 pages générées).
- Contrôle du programme : zéro source m1a, mobile, React Native ou .worktrees ; `FormData.get` résolu avec les déclarations DOM/web.
- Tests : 212 ciblés existants/adaptés, 4 upload documentaire, 2 périmètre web/FormData, 55 maintenance Boussole, 60 moteur, 4 QA compilés : **337 réussis**.
- Vérification séparée de D-020 : 10 tests, **8 réussis / 2 échecs connus**. Aucun de ces tests n'est masqué ou exclu du typecheck.
- Inventaires complets avant/après : [debt-ts-01-inputs.json](debt-ts-01-inputs.json).
- Rapport, commandes et limites : [debt-ts-01.md](debt-ts-01.md).
- Jalon autorisé : commit unique `chore(types): isolate web typecheck and clear diagnostics`, sans push. Son hash final sera fourni dans le compte rendu du jalon. Un commit ne peut pas contenir son propre hash final : l'ajout de ce hash au registre nécessitera une modification ultérieure explicitement autorisée. Aucun second commit ni amend automatique ; conserver ce statut technique jusqu'à l'enregistrement du hash, sans effacer la baseline historique.

## Suites à prévoir pour les dettes ouvertes

- D-003/D-018 : tests inter-propriétaires sur archive, suppression, duplication, templates utilisés et brouillons ; garantir absence de mutation en cas de refus. Les simulations d'audit ne remplacent pas une suite de régression versionnée.
- D-002/D-019 : tests de contexte par propriétaire/Portfolio/Workspace/parcours, identifiants invalides refusés, destinations internes normalisées ; ne pas confondre visibilité UI et validation serveur.
- D-004 : collisions de slug, Workspace archivé, actif et attaché ; conserver le test de création contextualisée qui interdit déplacement/réactivation.
- D-015/D-020 : définir les cohortes métier attendues, vérifier les compteurs par propriétaire puis réviser les assertions de source obsolètes selon le contrat Accueil actuel.
- D-016 : définir la politique avant modification ; conserver les tests de rôles Feedback/Champagne.
- D-005 à D-014 : recette humaine des libellés/densité, navigation et accessibilité ; maintenance Boussole si une surface guidée change.

Les corrections P0 d'autorisation D-003/D-018 restent des prérequis distincts avant UX-02. La résolution TypeScript ne vaut pas validation de sécurité ni remboursement des autres dettes.
