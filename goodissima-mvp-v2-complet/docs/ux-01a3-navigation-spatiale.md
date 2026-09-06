# UX-01A.3 — Navigation spatiale

## A. Résumé exécutif

Le ConnectedShell dispose d’une barre commune **Retour, Suivant, Remonter, Accueil et fil d’Ariane**. La navigation globale UX-01A.2 est conservée.

Retour/Suivant parcourent l’historique natif du navigateur, avec activation limitée aux entrées voisines reconnues pendant la présence du shell connecté. Remonter utilise un ancêtre logique cliquable, distinct de l’historique. Les noms métier des six pages de détail viennent de leurs données serveur ; aucun libellé n’est dérivé d’un segment technique d’URL.

562 tests QA réussis, maintenance Boussole et durcissement réussis, scénarios Chrome réussis aux cinq largeurs demandées. Le build retrouve la dette `FormData.get`. Aucun nouveau diagnostic TypeScript applicatif. Recette humaine avec services et données réels encore nécessaire.

Aucune route Workspace, aucun Explorateur, aucune migration, aucun changement d’autorisation ou d’API. Aucun commit ni déploiement. UX-01B non commencé.

## B. Barre de navigation spatiale

`SpatialNavigationBar` est monté une seule fois dans ConnectedShell, sous la barre globale et avant le contenu métier.

```text
Navigation globale UX-01A.2
Retour · Suivant · Remonter · Accueil     Fil d’Ariane
Titre, actions et contenu métier existants
```

Accueil conserve une seule destination : **`/dashboard`**, pour le logo, la commande Accueil et les liens Accueil du fil d’Ariane.

Le groupe App Router `(connected)` reste la frontière de montage. Aucun changement de `app/layout.tsx`, du layout connecté ou du middleware. Les surfaces publiques, auth et invitées ne reçoivent pas la barre, même avec une session propriétaire.

## C. Comportement Retour

La commande appelle `router.back()`. Elle ne fabrique aucune destination de repli.

La disponibilité est déterminée à partir des clés et index des entrées natives exposées par `window.navigation`. L’événement `currententrychange` signale les changements d’entrée et les remplacements natifs. Références techniques : [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), [currententrychange](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/currententrychange_event).

Le shell conserve uniquement, en mémoire, un ensemble de clés opaques d’entrées qu’il a observées sur les 34 routes A. Cet ensemble ne représente pas une pile d’URL : ordre, position et branche courante sont toujours lus dans l’historique natif. Les clés disparues sont retirées.

La commande est active uniquement si l’entrée immédiatement précédente possède un index adjacent et une clé connue. Les URL des entrées, leur état et leurs titres ne sont ni lus ni enregistrés. Aucun `localStorage`, `sessionStorage`, ajout dans `history.state` ou interception de `pushState` n’est introduit par le produit.

Le pathname courant est examiné transitoirement pour reconnaître une route A ; les paramètres de requête ne sont pas utilisés. Le catalogue explicite de pages sert aux libellés et à cette vérification, pas au montage du shell.

Cas conservateurs :

- Arrivée directe, nouvel onglet ou rechargement : aucun précédent connu, Retour désactivé.
- Entrée précédente inconnue, publique, invitée ou extérieure : Retour désactivé dans le shell.
- Passage hors A : les clés connues sont oubliées ; le retour ultérieur dans le shell recommence une observation vide.
- Navigateur sans Navigation API exploitable : Retour et Suivant restent désactivés, car leur disponibilité ne peut pas être établie sûrement.

Les commandes natives du navigateur restent libres et peuvent quitter Goodissima. Le shell ne les bloque pas. Il ne propose pas lui-même une traversée vers une entrée extérieure ou inconnue. Il ne prétend pas connaître l’historique antérieur au montage courant.

## D. Comportement Suivant

La commande appelle `router.forward()` quand l’entrée native immédiatement suivante est connue.

Après A → B → Retour vers A, B reste dans l’historique natif et Suivant est disponible. Après un Retour suivi d’une nouvelle navigation vers C, le navigateur supprime l’ancienne branche suivante ; la disponibilité est recalculée sans reconstruire cette branche.

Les remplacements d’entrée sont également relus depuis l’historique natif. Pendant une traversée déclenchée par la barre, les deux commandes sont désactivées jusqu’au changement d’entrée pour éviter plusieurs demandes concurrentes.

## E. Règles Remonter

Remonter sélectionne le dernier ancêtre **cliquable** du fil d’Ariane. Il ne découpe pas le pathname et ne s’appuie pas sur l’écran précédemment visité.

| Contexte | Remonter |
| --- | --- |
| Dashboard | Désactivé |
| Page globale simple : Boussole, Annuaire, Identité, Paramètres… | Accueil |
| Création ou sous-page d’une collection explicitement connue | Collection déclarée : Portfolios, Opportunités, Mes espaces ou Administration selon la page |
| Portfolio | Mes espaces, vue existante qui liste les Portfolios |
| Pilotage d’un Portfolio | Ce Portfolio |
| Objet avec Workspace et Portfolio accessibles | Portfolio, en sautant le Workspace non cliquable |
| Objet avec Workspace sans Portfolio | Mes espaces |
| Objet sans Workspace | Mes espaces |
| Aucun ancêtre cliquable ou contexte d’entité pas encore reçu | Désactivé |

Mes espaces est ici le niveau de consultation existant des objets gouvernés, pas un parent de base de données ajouté artificiellement. Ce repli correspond au chemin explicite demandé pour les objets sans Workspace.

Les pages globales et formulaires de création utilisent une petite déclaration de parents de navigation dans `lib/spatial-navigation.ts`. Aucune relation entre objets n’en est déduite.

## F. Résolution du fil d’Ariane

Un composant commun `Breadcrumb` rend le fil. `SpatialNavigationProvider` reçoit les informations minimales des pages via `PageNavigationContext`.

Deux sources explicites :

1. Pages globales : dictionnaire de libellés métier stables couvrant les routes A, notamment Accueil, Boussole, Annuaire, Mes espaces, Identité et Paramètres.
2. Pages d’objet : les pages serveur transmettent leur chemin canonique, les noms métier et les ancêtres autorisés, après leurs contrôles existants.

Le contexte transmis est associé au pathname de la page. Lors d’un changement de route, un contexte de la page précédente ne peut pas être affiché sur la nouvelle. Le nettoyage d’une ancienne page ne peut pas effacer un contexte plus récent.

Avant réception des données d’une page de détail, un libellé générique stable est affiché et Remonter reste désactivé. Aucun ID n’est montré pendant cette phase.

| Page de détail | Libellé courant | Relations utilisées |
| --- | --- | --- |
| `/gouvernance/portfolios/[id]` | Nom du Portfolio chargé par le repository existant | Collection Mes espaces |
| `/gouvernance/portfolios/[id]/pilotage` | Salle de pilotage | Portfolio chargé et autorisé |
| `/gouvernance/parcours/[id]/pilotage` | Titre métier déjà calculé par la page | `relationTemplate.workspace.portfolio` |
| `/templates/[templateId]` | Nom localisé déjà utilisé dans le titre de page | `relationTemplate.workspace.portfolio` |
| `/links/[linkId]` | Titre du lien | `gLink.workspace.portfolio` |
| `/cases/[caseId]` | Titre déjà affiché pour le dossier, issu du lien | `relationCase.workspace.portfolio` |

Les deux pages Portfolio réutilisent intégralement les données déjà chargées. Les quatre autres pages enrichissent leur requête existante par une sélection étroite du Workspace et du Portfolio : ID, nom, propriétaire. Aucun nouvel appel générique depuis le layout, aucun endpoint de résolution et aucune requête par niveau de breadcrumb. Prisma peut néanmoins réaliser les lectures relationnelles supplémentaires nécessaires à cet enrichissement.

Les nouveaux libellés/ancêtres Workspace et Portfolio ne sont transmis que si leur `ownerId` correspond au propriétaire courant. Les contrôles métier et les requêtes de sélection initiales des objets restent inchangés. Les noms issus d’anciennes métadonnées de rattachement, slugs et IDs ne servent pas de substitut à une relation courante.

`businessLabel` utilise les noms métier, avec repli stable si le nom manque, contient un ID connu ou ressemble à une URL/token/identifiant technique. Ce garde-fou ne renomme pas l’objet. Les IDs nécessaires aux liens restent uniquement dans les URL canoniques existantes, jamais dans le texte ou les titres du breadcrumb. Aucun token ni paramètre de requête n’est fourni au composant.

## G. Cas Portfolio / Workspace / Parcours

```text
Avec Portfolio et Workspace :
Accueil > Portfolio Europe > Workspace Contentieux > Parcours Martin
          cliquable          texte seulement
Remonter → Portfolio Europe

Avec Workspace sans Portfolio :
Accueil > Mes espaces > Workspace Contentieux > Parcours Martin
          cliquable     texte seulement
Remonter → Mes espaces

Sans Workspace :
Accueil > Mes espaces > Parcours Martin
Remonter → Mes espaces
```

Les mêmes règles s’appliquent aux liens et dossiers. Un Workspace appartenant à un autre propriétaire est omis de la navigation ; un Portfolio non accessible est omis tout en conservant le Workspace accessible. Aucun rattachement absent n’est reconstruit à partir du nom ou des métadonnées.

Aucune route `/workspace/...` ou équivalente n’est créée.

## H. Responsive

| Largeur | Barre globale conservée | Hauteur spatiale sur chemin long | Débordement horizontal |
| --- | --- | --- | --- |
| 320 px | 113 px | 91 px | Aucun |
| 390 px | 113 px | 91 px | Aucun |
| 768 px | 113 px | 81 px | Aucun |
| 1024 px | 61 px | 57 px | Aucun |
| 1440 px | 61 px | 57 px | Aucun |

Mesures Chrome, hauteur 900 px. La vérification distingue la largeur utile du document de la barre de défilement verticale.

Desktop : commandes et breadcrumb partagent une ligne. Tablette : le fil peut passer sous les commandes. Mobile : Retour/Suivant/Remonter utilisent des icônes avec labels accessibles et infobulles ; Accueil conserve son texte. Le breadcrumb reste sur une ligne : **Accueil > … > Page courante**.

Les niveaux intermédiaires masqués restent accessibles dans la divulgation « Afficher les niveaux intermédiaires ». Le Workspace y reste du texte. Les noms longs sont tronqués visuellement, mais leur texte complet reste dans le DOM et le nom courant dispose d’un titre complet.

Les captures mobile et desktop avec chemin long ont été inspectées. La barre reste dans le flux et ne recouvre pas les commandes globales ou les notifications.

## I. Accessibilité et Boussole

Boutons HTML natifs, état `disabled`, labels explicites et focus visible. La commande Remonter est un lien réel lorsqu’un parent existe, un bouton désactivé sinon. Les liens Accueil partagent tous `/dashboard`.

Le breadcrumb utilise `nav` avec `aria-label="Fil d’Ariane"`, une liste ordonnée et `aria-current="page"` pour la page courante. Les liens sont soulignés ; les niveaux non cliquables sont du texte. Les séparateurs sont décoratifs. La divulgation mobile est utilisable au clavier et se ferme par Échap avec retour du focus à sa commande.

La navigation principale et le breadcrumb constituent deux repères distincts ; il reste une seule navigation globale à trois portes.

La procédure `docs/boussole-maintenance.md` a été consultée. Les six pages modifiées conservent leurs cibles existantes et leurs conditions EMPTY/POPULATED/FOCUSED. Le composant de contexte ne rend aucun élément de page et ne crée aucune cible fictive. Aucun `pageId`, `stepId`, fallback, ordre fonctionnel ou `journeyVersion` n’est modifié. Le mécanisme de divulgation de navigation UX-01A.2 et le périmètre de ContextualBoussole sont conservés.

## J. Tests

| Suite / vérification | Résultat |
| --- | --- |
| Tous les `qa/*.test.ts` de premier niveau | **562 réussis, 0 échec** |
| `npm.cmd run qa:spatial-navigation` | **17 réussis** |
| `npm.cmd run qa:boussole-maintenance` | **54 réussis**, toutes les sous-suites |
| `npm.cmd run qa:ux-01a-hardening` | **33 réussis** |
| Autres suites UX, navigation, candidat, auth, gouvernance et feedback | Incluses dans les 562 tests |
| `npm.cmd run qa:connected-navigation` | Cinq scénarios Chrome réussis + nouvel onglet |
| Inventaire de routes existant | 46 pages et 84 handlers inchangés |
| Comparaison des surfaces exclues et handlers avec UX-01A.2 | Contenus inchangés |
| `git diff --check` | Réussi |

Les 17 tests spécifiques couvrent A → B → Retour → Suivant, nouvelle branche, arrivée directe/nouvel observateur, remplacement natif, entrée inconnue, frontière A/B/C, absence de lecture des URL/états d’historique, parents facultatifs, propriété des rattachements, labels techniques masqués, Accueil et désactivation avant contexte d’objet.

Le test Chrome existant est enrichi pour servir une fixture sur une origine HTTP locale. Il utilise de **vraies entrées `history.pushState` et de vraies traversées `history.back/forward`**, observées par Navigation API. Il vérifie les contrôles réels, les branches, la sortie vers B/C et la réinitialisation conservatrice, un nouvel onglet, un paramètre token absent du texte, le fil long, ses niveaux masqués, Remonter et Accueil aux cinq largeurs.

Les contrôles UX-01A.2 restent testés : clavier, menu utilisateur, langue, déconnexion, anciennes destinations secondaires, Boussole et notifications.

Limites : les composants/CSS et l’historique navigateur sont réels ; le transport Next, les services d’authentification et les données métier sont simulés dans la fixture. Les tests unitaires vérifient les règles de résolution ; une recette complète Next/Supabase/PostgreSQL sur données réelles reste nécessaire. Aucun compte ou objet métier de démonstration n’est créé par ces tests.

## K. Build et diagnostics

`npm.cmd run build` exécuté une fois. Compilation des modules réussie, puis même arrêt que la baseline UX-01A.2 :

```text
app/api/documents/upload/route.ts:128:27
Property 'get' does not exist on type 'FormData'.
```

Cette dette n’est pas corrigée. `tsconfig.tsbuildinfo` est restauré après le build.

Le typage applicatif comparatif utilise les mêmes options et exclusions `.next/` et `m1a/` qu’au lot précédent : **2 diagnostics avant, 2 identiques après, aucun ajouté**. Les dettes restent TS2352 dans `qa/candidate-form-safety.test.ts` et TS7023 dans `qa/matching-lifecycle.test.ts`. Aucun nouveau diagnostic imputable au lot n’est laissé.

## L. Risques / dettes restantes

### Formulaires non enregistrés

L’audit des sources connectées n’a trouvé aucun garde explicite `beforeunload`, `popstate` ou protection générique de formulaire modifié. Les confirmations métier existantes, notamment annulation de réunion et transitions de revue, sont préservées ; elles ne protègent pas les changements de page.

| Pages / composants | Saisies pouvant être perdues au départ de la page |
| --- | --- |
| `/links/simple` — simple-link-builder | Titre, description, message, champs et validation locale avant création |
| `/links/new` — NewLinkForm | Annonce et options de formulaire avant création |
| `/opportunities/new` et outils AITemplateDesigner | Besoin, brouillon proposé, retours de révision, instructions et transcription non appliquée |
| `/gouvernance/nouveau` — GovernanceJourneyAssistant et formulaire | Besoin, proposition, acteurs, documents, objectif et actions avant création |
| `/gouvernance/workspaces/nouveau`, `/gouvernance/portfolios/nouveau` | Champs du formulaire avant envoi |
| `/gouvernance`, détail Portfolio | Sélections de rattachement non transmises |
| Cockpit de parcours | Notes, invitations préparées dans le formulaire, réception documentaire, réunions et revue avant soumission |
| `/templates/[templateId]` — ManualJourneyEditor, TemplateFieldManager, TemplateAIInstructionsEditor | Design/champs/instructions modifiés et motif avant sauvegarde |
| `/links/[linkId]` — AnnouncementActions | Titre, ville et description en cours d’édition |
| `/cases/[caseId]` — ChatBox, RelationActionsPanel | Message non envoyé et nouvelle action non enregistrée |
| `/settings` — SettingsPanel | Organisation, sécurité, notifications et invitation avant sauvegarde/envoi |
| `/administration/feedback` | Notes et changement de statut non soumis ; filtres avant application |

Ces risques existaient avec les liens de navigation précédents ; la nouvelle barre rend le départ plus accessible. Le retour du navigateur ou le cache de Next peut parfois restaurer un état, mais aucune conservation n’est garantie par ce lot. Aucun garde arbitraire, autosave ou historique de brouillon n’est ajouté.

### Autres réserves

- Sur les navigateurs sans Navigation API exploitable, et après rechargement, les commandes d’historique sont volontairement conservatrices. La navigation native du navigateur reste utilisable.
- Une page de détail affiche brièvement son libellé générique avant réception du contexte client ; Remonter est désactivé durant cette phase.
- « Mes espaces » reste `/gouvernance`. Le Workspace reste non cliquable ; le saut vers le Portfolio ou Mes espaces est explicite.
- Les noms inhabituels ressemblant à un identifiant peuvent être remplacés par un libellé générique dans le breadcrumb.
- Administration conserve sa politique existante. Aucun changement de capability ou de droits.
- Le build global reste bloqué par la dette connue. Les sessions et états Boussole réels nécessitent la validation humaine demandée par la maintenance.

Risque estimé : **intermédiaire**, principalement pour les saisies non enregistrées et la recette avec le routeur/services réels.

## M. Diff résumé

Fichiers créés :

```text
components/SpatialNavigationBar.tsx
components/SpatialNavigationContext.tsx
lib/connected-history.ts
lib/spatial-navigation.ts
qa/spatial-navigation.test.ts
docs/ux-01a3-navigation-spatiale.md
```

Fichiers modifiés :

```text
components/ConnectedShell.tsx
app/(connected)/cases/[caseId]/page.tsx
app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx
app/(connected)/gouvernance/portfolios/[id]/page.tsx
app/(connected)/gouvernance/portfolios/[id]/pilotage/page.tsx
app/(connected)/links/[linkId]/page.tsx
app/(connected)/templates/[templateId]/page.tsx
qa/helpers/render-connected-shell.ts
scripts/qa-connected-navigation.mjs
package.json
```

Six pages enrichies uniquement pour le contexte de navigation et les sélections relationnelles minimales, deux composants communs, règles explicites et tests. Aucun fichier supprimé, route déplacée, API changée ou migration créée. Les changements antérieurs UX-01A.0/1/2 déjà présents restent conservés et ne sont pas attribués à ce lot.

UX-01A.3 :

- [ ] prêt
- [x] prêt avec réserves
- [ ] bloqué
