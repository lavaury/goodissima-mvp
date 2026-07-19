# Maintenance continue de Boussole

Ce guide est la procédure obligatoire avant toute évolution d’une page, d’un micro-parcours, d’une cible ou de la progression Boussole. Les `data-boussole-id` sont des contrats fonctionnels : une modification visuelle ou métier doit préserver leur sens ou traiter explicitement son impact.

## Version des micro-parcours

Examiner `journeyVersion` pour chaque micro-parcours touché. L’incrémenter lorsqu’une étape est ajoutée au milieu ou supprimée, lorsque l’ordre fonctionnel change, lorsqu’un `stepId` ou la signification d’une étape change, ou lorsque de nouvelles conditions d’applicabilité rendent une ancienne progression incohérente.

Ne pas l’incrémenter pour une correction orthographique, une amélioration rédactionnelle sans changement de sens, une modification CSS ou un changement de durée indicative. La version appartient au micro-parcours, pas seulement à la page.

## Identifiants stables

- Conserver des `pageId`, `journeyId`, `stepId` et `targetId` sémantiques et stables.
- Ne jamais dériver un identifiant d’un titre, d’un texte traduit ou d’un contenu utilisateur.
- Ne jamais placer un identifiant de base de données dans un référentiel Boussole.
- Toute étape reprise doit posséder un `stepId`; un changement de cet ID exige d’examiner la version.

## États réels et applicabilité

Chaque micro-parcours déclare ses `applicableStates` parmi `EMPTY`, `POPULATED` et `FOCUSED`.

- `EMPTY` : aucun objet réel; expliquer honnêtement l’état vide et la création du premier objet.
- `POPULATED` : cibler le premier objet réel visible correspondant au type et à l’état attendus.
- `FOCUSED` : guider uniquement l’objet réel actuellement ouvert.

Ne jamais créer de donnée de démonstration ou d’objet fictif pour fournir une cible.

## Cibles et fallback

Une cible dynamique facultative doit être déclarée facultative. Tout fallback reste dans le même micro-parcours et pointe vers une cible déclarée par celui-ci. Une cible absente est ignorée proprement et ne déclenche aucune action métier. « Montrer la zone » met en évidence ou fait défiler; il ne clique jamais. Les diagnostics de cible absente restent limités au développement.

## Sécurité du contexte et de la progression

Le contexte et la progression Boussole ne contiennent que les identifiants fonctionnels et états strictement nécessaires. Ils ne doivent jamais contenir de token, URL sécurisée complète, email, identité candidate, contenu de message, contenu documentaire, pièce jointe, secret ou donnée métier inutile. La progression reste locale au navigateur et n’est pas synchronisée avec le serveur.

## Checklist d’impact copiable

- [ ] `pageId` existant ou nouveau déclaré
- [ ] `journeyId` stable et unique
- [ ] `journeyVersion` examinée
- [ ] `stepId` stable et unique
- [ ] `applicableStates` déclarés
- [ ] `targetId` présent dans le manifeste de page
- [ ] cible `EMPTY` cohérente
- [ ] cible `POPULATED` issue d’un objet réel
- [ ] cible `FOCUSED` limitée à l’objet ouvert
- [ ] fallback limité au micro-parcours
- [ ] aucune action métier
- [ ] aucune donnée de démonstration
- [ ] aucune donnée sensible
- [ ] progression compatible ou version incrémentée
- [ ] tests ciblés ajoutés ou adaptés
- [ ] build réussi
- [ ] dépôt propre après commit

## Validation et procédure Git

1. Partir d’une branche `staging` propre et alignée avec `origin/staging`.
2. Limiter la modification au périmètre nécessaire et remplir la checklist.
3. Exécuter les tests ciblés, puis `npm.cmd run qa:boussole-maintenance`.
4. Exécuter `npm.cmd run build` une seule fois à la fin.
5. Restaurer `tsconfig.tsbuildinfo` après le build.
6. Exécuter `git diff --check` et relire le diff.
7. Faire valider humainement, puis committer le lot explicitement.
8. Pousser le commit.
9. Confirmer que `staging` et `origin/staging` sont alignés et que le dépôt est propre.

Codex ne committe et ne pousse jamais automatiquement une évolution Boussole.
