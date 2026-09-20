# Maintenance Boussole

- Les `data-boussole-id` sont des contrats fonctionnels stables.
- Boussole privilégie les objets réels.
- Les états communs sont `EMPTY`, `POPULATED` et `FOCUSED`.
- Aucun objet fictif ne doit être créé pour fournir une cible.
- « Montrer la zone » ne déclenche aucune action métier.
- Un fallback reste dans le même micro-parcours.
- Toute modification d’une page guidée doit évaluer l’impact Boussole.
- Toute mise à jour doit être testée et validée humainement.

Avant toute modification Boussole, consulter `docs/boussole-maintenance.md`, identifier l’état `EMPTY`, `POPULATED` ou `FOCUSED` concerné et déterminer si `journeyVersion` doit changer. Ne jamais créer de cible ou de donnée fictive. Exécuter `npm.cmd run qa:boussole-maintenance` et ne pas committer automatiquement.
