# MG-5 — consultation de la mémoire gouvernée

## Objectif et emplacement

MG-5 ajoute une surface strictement read-only à l'intérieur d'un `RelationCase` : `/cases/{relationCaseId}/memory`. Le workspace propriétaire affiche le lien « Mémoire » et la page offre un retour explicite au dossier.

La page ne prouve jamais l'existence d'une mémoire avant l'appel authentifié : un dossier absent ou inaccessible reçoit le même message prudent.

## Architecture

La route de page est un Server Component minimal. `GovernedMemoryPage` est un Client Component interactif qui utilise exclusivement le client `lib/governed-memory/client`. Celui-ci ne connaît que les contrats JSON MG-4 et effectue uniquement des GET vers `/api/internal/relation-cases/.../governed-memory`.

Les composants n'importent ni Prisma, ni Supabase, ni MG-2/MG-3. Le requester n'est jamais envoyé : MG-4 le dérive de la session. La vue Accès sans sujet explicite demande au serveur les droits du requester authentifié.

## Chargement et URL

Aucune vue n'est préchargée. Une requête part uniquement après validation et action explicite. Les changements de vue ou période annulent la requête précédente avec `AbortController`; un numéro de version ignore toute réponse obsolète.

L'URL peut contenir `view`, `referenceDate`, `from`, `to` et `knowledgeMode`. Elle ne contient ni curseur, sujet, décision, source, contenu ou limitation. Aucun résultat n'est conservé dans un stockage navigateur.

## Vues

### État à une date

Le mode « Ce qui était connu à cette date » correspond à `KNOWN_AT_DATE`. Le mode « Ce que nous savons aujourd'hui sur cette date » correspond à `CURRENT_KNOWLEDGE_ABOUT_DATE` et peut signaler `RECORDED_LATER`.

La vue sépare faits, décisions, sources visibles, contestations, événements et limitations. Les statuts affichés sont les statuts reconstruits à la référence, jamais implicitement les statuts courants.

### Comparaison

La comparaison utilise les catégories structurées MG-3 : apparitions, inapplicabilités, remplacements, annulations, restrictions, contestations et évolutions d'accès. Chaque carte distingue avant, après, date, type et degré de reconstruction. Aucun diff textuel ou résumé généré n'est produit.

### Timeline

La période est `[from, to)` : début inclusif, fin exclusive. La liste conserve l'ordre serveur `occurredAt ASC, id ASC`. `occurredAt` est principal et `recordedAt` est affiché séparément lorsqu'il diffère. La pagination utilise exclusivement `nextCursor`; aucun offset ou tri local n'existe.

### Décisions

Les explications sont chargées paresseusement. Elles distinguent motif déclaré, faits et sources explicitement liés, décisions antérieures, réserves, contestations, conséquences et limitations. Une mention rappelle que ces liens ne prouvent aucune causalité automatique.

### Accès

Faute d'endpoint borné listant des sujets autorisés, MG-5 ne propose aucune recherche d'utilisateur. La première interface reconstruit seulement les droits du compte authentifié : rôles, grants actifs, résiduels et révoqués, permissions effectives et limitations. Elle rappelle qu'un droit ne prouve pas une consultation.

### Trace

La trace d'un fait, d'une décision ou d'une source visible est chargée à la demande dans une section dédiée. Elle expose uniquement relations, validations, contestations, événements et limitations reçus de MG-4. Aucun identifiant d'objet relié n'est affiché.

## Occultations, sources et limitations

Un objet `FULLY_HIDDEN` ne produit aucun rendu, compteur, clé ou libellé. Si MG-3 autorise `EXISTENCE_DISCLOSED`, un message générique signale seulement qu'un élément inaccessible existe, sans type, titre, date, auteur ou identifiant.

Une source indisponible ne reçoit aucun lien actif. MG-5 ne construit jamais d'URL depuis un identifiant source. Les codes de limitations connus sont traduits par une table contrôlée; un code inconnu reçoit un texte générique et son identifiant interne n'est pas affiché.

### Provenance du parcours

Lorsqu’une source visible porte une provenance GJ, sa carte affiche un bloc secondaire « Provenance du parcours » : titre, statut actuel, puis événement facultatif avec libellé français, transition, date et numéro de séquence. Le statut actuel du parcours reste explicitement distinct du statut cible historique de l’événement.

Une source sans provenance ne rend aucun bloc. Une source cachée ou restreinte sans grant ne révèle aucun titre ou événement GJ. Aucun identifiant, motif, acteur ou autorité n’est affiché ; le bloc ne contient ni bouton, ni lien, ni navigation et n’est jamais injecté dans la timeline principale. Cette information ne constitue ni preuve supplémentaire, ni validation, ni droit sur le parcours et ne déclenche aucune action.

## Erreurs et états

Les chargements utilisent un skeleton non révélateur et retirent les anciennes données avant une nouvelle période. Les états vides emploient une formulation prudente. Les erreurs 401, 400, 404, 409 et 500 ont des textes distincts mais non divulguants; seul le `requestId` technique peut être montré au support.

## Accessibilité et responsive

Les onglets utilisent `tablist`, `tab`, `tabpanel`, `aria-selected` et des libellés visibles. Chargements et erreurs sont annoncés par `aria-live`; tous les champs ont un label; les focus sont visibles; statuts et niveaux sont textuels. Les cartes passent en une colonne sur mobile puis en grilles sur les écrans plus larges, sans tableau horizontal.

Les dates sont envoyées en UTC ISO 8601 et affichées en français dans le fuseau `Europe/Paris`, avec ce fuseau indiqué. Les contrôles `datetime-local` sont convertis explicitement en instant UTC.

## Performance et sécurité

Les requêtes sont bornées, les explications et traces paresseuses, la timeline paginée et les réponses demandées avec `cache: no-store`. Il n'existe ni boucle de fetch, ni préchargement des cinq vues, ni stockage persistant, console, HTML injecté, analytics ou URL documentaire reconstruite.

## Boussole

La mémoire est une capacité secondaire du dossier. La navigation existante conserve sa cible stable `case-relational-navigation`, sans nouvelle étape ni changement de signification. La page mémoire est exclue du contexte guidé du cockpit afin de ne pas rechercher ses cibles absentes. `journeyVersion` reste inchangée et aucune donnée fictive n'est créée.

## Hors périmètre

Édition, validation, contestation, promotion de source, gestion de droits, mutation HTTP, export, IA, synthèse, chatbot, recherche libre, embeddings, corrélation inter-dossiers, modification Prisma et migration restent hors MG-5.
