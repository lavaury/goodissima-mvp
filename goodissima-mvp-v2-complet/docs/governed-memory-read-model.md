# Modèle de lecture GovernedMemory

La couche `lib/governed-memory` expose uniquement une lecture bornée de la mémoire rattachée à un `GovernedJourney`. Elle ne fournit aucune méthode générique ou métier de création, modification ou suppression. En particulier, `GovernedMemoryEvent` est traité comme un journal en lecture seule et sa protection append-only est également imposée en base par `GovernedMemoryEvent_append_only`.

L'accès est contrôlé côté serveur. Un rôle mémoire actif au niveau Journey ouvre le périmètre du Journey ; un grant explicite reste limité aux dossiers (`relationCaseId`) sur lesquels `VIEW_MEMORY` est effectif. `VIEW_SOURCES` est vérifié séparément. Un Journey absent et un accès refusé produisent le même résultat logique afin de ne pas révéler l'existence d'une mémoire étrangère. L'autorité ou la propriété d'un objet ne remplace pas automatiquement une permission mémoire.

La projection sépare les faits, décisions, sources et éléments en attente. Une source reste une source : elle ne devient jamais un fait par inférence. Seuls un fait `PROPOSED` ou une décision `DRAFT` sont projetés comme éléments en attente. Les revues opérationnelles et l'historique du Journey ne sont ni lus ni requalifiés par ce service.

L'origine d'acteur conserve uniquement les valeurs du stockage, `HUMAN` ou `SYSTEM`. `SYSTEM` ne signifie pas « IA ». Une future intégration IA devra introduire une provenance explicite au lieu de déduire cette origine.
