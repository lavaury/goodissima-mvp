# UX-01B.1 — Workspace et Explorer V1

## Résultat

Route connectée ajoutée : `/gouvernance/workspaces/[id]`.
Piloter est une vue d’attente explicite ; `?view=explorer` ouvre les objets directs.
Les deux vues utilisent de vrais liens avec `aria-current` et l’historique natif.
Aucun menu Nouveau, moteur de pilotage, IA, archivage, restauration ou mutation métier ajouté.

## Lecture et autorisation

`lib/workspace-detail-repository.ts` cherche le Workspace par `id` et `ownerId` courant.
La page authentifie avant la lecture et appelle `notFound` pour un objet absent/non autorisé.
Un Workspace archivé reste consultable avec son état affiché.

Explorer sélectionne seulement les RelationTemplate, GLink et RelationCase dont
`workspaceId` correspond directement au Workspace. Les liens et dossiers sont aussi
filtrés par propriétaire. Aucun fallback par lien, parcours, invitation ou communication.
Les sélections excluent tokens, emails candidats, documents et métadonnées.
Le parcours ouvre le cockpit avec l’identifiant du premier FormTemplate, trié par
date de création ; sans formulaire, une indication remplace le lien.
Les GLink ne sont jamais dupliqués sous un type Opportunity.

## Navigation

Gouvernance expose un lien sur le nom de chaque Workspace.
Les repositories Workspace et Portfolio retournent la destination Workspace canonique,
sans fallback vers le premier parcours.
Le breadcrumb comporte Accueil, Mes espaces, Portfolio autorisé éventuel, Workspace,
puis l’objet courant. Remonter suit cette hiérarchie. Le Workspace courant reste non cliquable.
Les surfaces publiques/invitées, le middleware et le ConnectedShell ne sont pas modifiés.

## Impact Boussole

Procédure consultée : `docs/boussole-maintenance.md`.
Les cibles existantes Gouvernance EMPTY/POPULATED gardent leur sens et leurs identifiants.
La nouvelle page est un Workspace FOCUSED, avec Explorer vide ou peuplé : elle ne doit
pas hériter des cibles du guide de collection Gouvernance. Son contexte Boussole est
donc explicitement absent dans ce lot, quelle que soit la vue. Aucun guide fictif,
aucune cible artificielle ni objet de démonstration produit n’a été ajouté.
Les étapes existantes ne changent ni d’ordre ni de signification : journeyVersion inchangé.
Validation humaine du lot encore nécessaire ; aucun commit/push automatique.

## Vérifications

- Workspace, navigation spatiale, ConnectedShell : 80 tests réussis.
- Maintenance complète Boussole : réussie.
- UX-01A hardening : réussi.
- Portfolio, attention Gouvernance et release polish : 17 tests réussis.
- Chrome : 320, 390, 768, 1024 et 1440 px ; aucun débordement horizontal Explorer,
  liens visibles, breadcrumb condensé, Remonter, objet et Retour/Suivant entre vues réussis.
- Captures Workspace mobile et desktop inspectées.
- Les tests exécutent les vraies pages/composants/repositories avec dépendances explicites
  simulées. Chrome utilise React et Tailwind réels, un transport de navigation local et
  des données de test en mémoire. Aucune base réelle ni session utilisateur réelle utilisée.
- Build : modules compilés, puis échec préexistant `FormData.get`,
  `app/api/documents/upload/route.ts:128`. Dette laissée intacte.
- Vérification TypeScript hors `.next` et `m1a` : uniquement les deux diagnostics connus
  TS2352 dans candidate-form-safety et TS7023 dans matching-lifecycle ; aucun nouveau.
- `tsconfig.tsbuildinfo` restauré après le build ; `git diff --check` réussi.

## Suite hors lot

Pilotage Workspace complet, IA et création contextualisée restent différés.
UX-01B.2 n’est pas commencé. La recette humaine avec services et données réels reste à faire.
