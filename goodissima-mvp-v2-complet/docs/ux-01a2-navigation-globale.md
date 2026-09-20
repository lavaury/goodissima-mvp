# UX-01A.2 — Simplification de la navigation globale

## A. Résumé exécutif

Le ConnectedShell présente désormais trois portes principales : **🧭 Boussole**, **🌍 Annuaire**, **🗂 Mes espaces**. Le logo et son libellé visible **Accueil** conduisent à `/dashboard`. Une zone **Utilisateur** regroupe le compte, la langue, la déconnexion et les accès secondaires conservés pour la transition.

Aucune route, page métier, règle d’autorisation, API ou migration n’est modifiée. Les 34 pages A restent dans le shell ; les surfaces B/C restent exclues, quelle que soit la session.

545 tests QA réussis, maintenance Boussole réussie, tests Chrome interactifs réussis aux cinq largeurs demandées. Le build retrouve la dette connue `FormData.get`. Recette humaine avec sessions et données réelles encore nécessaire. Aucun commit ni déploiement ; UX-01A.3 non commencé.

## B. Navigation avant / après

Avant : 16 destinations exposées dans la navigation globale, défilement horizontal, badge d’organisation permanent et rangée séparée pour le logo/langue/déconnexion.

Après :

```text
Desktop
Logo + Accueil     Boussole · Annuaire · Mes espaces     Utilisateur ▾
Contenu métier

Mobile / tablette
Logo + Accueil                                         Utilisateur ▾
               Boussole · Annuaire · Mes espaces
Contenu métier
```

Le même élément `nav` contient les trois portes à toutes les tailles. Il n’existe aucune copie desktop/mobile. Le contenu métier et ses en-têtes restent en dessous, inchangés.

## C. Destination provisoire de « Mes espaces »

**`/gouvernance`** est retenue. Cette page existante réunit déjà les Portfolios, les Workspaces visibles et leurs objets : parcours gouvernés, dossiers relationnels et liens. Elle permet également de retrouver les objets non rattachés à un Workspace.

`/gouvernance/portfolios` aurait limité l’entrée aux seuls Portfolios. La page de gouvernance offre la vue existante la plus large sans créer d’écran ni de route.

Le libellé visible de la porte est **Mes espaces**. Le titre métier de la page de destination et son URL technique restent inchangés. Il s’agit d’une destination provisoire, pas d’un nouvel explorateur.

## D. Entrées retirées de la navigation globale principale

Le classement a été effectué avant le retrait de la barre à seize entrées. Pour éviter de dépendre exclusivement d’accès contextuels parfois dispersés ou conditionnels à des données, tous les anciens liens disposent d’une alternative permanente dans le shell.

| Ancienne entrée | Nature | Place retenue |
| --- | --- | --- |
| Dashboard | Globale, accueil | Logo et libellé Accueil |
| Boussole | Globale, découverte/apprentissage | Porte principale Boussole |
| Annuaire | Globale | Porte principale Annuaire |
| Gouvernance | Globale, accès aux espaces gouvernés | Porte principale Mes espaces |
| Lien simple | Métier | Autres accès |
| Salle de pilotage | Métier | Autres accès |
| Portfolios | Métier | Autres accès |
| Nouveau parcours | Action métier | Autres accès |
| Confiance | Secondaire | Autres accès |
| Opportunités | Métier | Autres accès |
| Parcours | Métier | Autres accès |
| Relations | Métier | Autres accès |
| IA & Valeur | Secondaire, analytique/administrative selon les contrôles existants | Autres accès |
| Administration | Administrative | Autres accès, comportement inconditionnel conservé |
| Identité | Utilisateur | Utilisateur |
| Paramètres | Utilisateur | Utilisateur |

Les dix entrées métier/secondaires/administratives ci-dessus quittent la navigation principale, avec un accès explicite conservé. Identité et Paramètres sont déplacés dans le compte. Aucun ancien lien critique n’est supprimé sans alternative.

## E. Où les fonctions restent accessibles

| Fonction | Chemin de navigation conservé | URL |
| --- | --- | --- |
| Accueil | Logo + Accueil | `/dashboard` |
| Découverte Boussole | Boussole | `/boussole/decouverte` |
| Annuaire | Annuaire | `/annuaire` |
| Gouvernance / espaces | Mes espaces | `/gouvernance` |
| Identité | Utilisateur → Identité | `/identity` |
| Paramètres | Utilisateur → Paramètres | `/settings` |
| Lien simple | Utilisateur → Autres accès → Lien simple | `/links/simple` |
| Salle de pilotage | Utilisateur → Autres accès → Salle de pilotage | `/gouvernance/pilotage` |
| Portfolios | Utilisateur → Autres accès → Portfolios | `/gouvernance/portfolios` |
| Nouveau parcours | Utilisateur → Autres accès → Nouveau parcours | `/gouvernance/nouveau` |
| Confiance | Utilisateur → Autres accès → Confiance | `/trust/connectors` |
| Opportunités | Utilisateur → Autres accès → Opportunités | `/opportunities` |
| Parcours | Utilisateur → Autres accès → Parcours | `/parcours` |
| Relations | Utilisateur → Autres accès → Relations | `/relations` |
| IA & Valeur | Utilisateur → Autres accès → IA & Valeur | `/ia-valeur` |
| Administration | Utilisateur → Autres accès → Administration | `/administration` |

Tous les accès contextuels des pages restent présents : aucun fichier sous `app/` n’a été modifié par UX-01A.2. Les alias `/parcours` et `/ia-valeur` gardent leur implémentation et leur URL.

## F. Zone utilisateur et utilitaires

La commande **Utilisateur**, en haut à droite, ouvre une divulgation native `details/summary` contenant :

- le badge d’organisation existant, déplacé dans le panneau pour alléger la barre ;
- Identité et Paramètres ;
- le composant LanguageSwitcher existant, une seule fois ;
- LogoutButton existant, sans modification de son traitement ;
- une rubrique repliable Autres accès avec les dix destinations conservées.

Administration demeure visible dans cette rubrique pour tous, comme auparavant. Aucune capability, aucun faux `isAdmin`, aucun nouveau droit ni changement d’autorisation.

GlobalLanguageSwitcher, ToastProvider et FeedbackButton conservent leur montage et leur code UX-01A.1. Le sélecteur flottant reste absent sur A, car le même contrôle est disponible dans Utilisateur. Les notifications gardent leur place avant le shell. Feedback reste à son emplacement existant.

ContextualBoussole reste uniquement sur A. Son changement se limite à reconnaître et révéler les liens réels rangés dans les divulgations de navigation marquées `data-boussole-disclosure="navigation"`.

## G. Responsive

| Largeur vérifiée | Lignes permanentes | Hauteur du header | Débordement horizontal du document |
| --- | --- | --- | --- |
| 320 px | 2 | 113 px | 0 px |
| 390 px | 2 | 113 px | 0 px |
| 768 px | 2 | 113 px | 0 px |
| 1024 px | 1 | 61 px | 0 px |
| 1440 px | 1 | 61 px | 0 px |

Mesures dans Chrome headless à hauteur de fenêtre 900 px, avec le vrai CSS Tailwind, les composants React et un libellé d’organisation volontairement long. Les trois portes restent visibles, sans troncature, à toutes ces tailles. Une troisième ligne permanente ou un menu mobile supplémentaire n’est donc pas nécessaire.

Le panneau utilisateur est borné par la largeur du viewport et dispose d’un défilement vertical interne. Les liens secondaires restent accessibles jusqu’à Administration. Le badge tronque les noms longs. Les contrôles de langue/déconnexion peuvent se replier dans le panneau.

Par rapport aux mesures UX-01A.1 : 113 px au lieu de 189 px sur mobile et 61 px au lieu de 149 px sur desktop. Le header reste dans le flux, sans fixation pendant le défilement.

Les captures des menus ouverts et fermés et les résultats JSON sont produits dans un répertoire temporaire indiqué par le script de test. Les captures à 320 et 1440 px ainsi que le panneau ouvert à 320 px ont été inspectés.

## H. Accessibilité et Boussole

Une seule navigation principale possède le libellé accessible « Navigation principale ». Les emojis sont décoratifs (`aria-hidden`). Les liens gardent des libellés textuels explicites.

Le lien actif combine graisse, soulignement et `aria-current` : `page` pour une destination exacte, `location` pour la zone Mes espaces ou Boussole lorsqu’une sous-page est ouverte. Le contraste de couleur n’est pas le seul indicateur.

Les divulgations natives exposent leur état ouvert/fermé aux technologies d’assistance sans simuler un menu applicatif ARIA. Entrée et Espace ouvrent la zone utilisateur ; Tab rejoint les liens ; Échap ferme le panneau et rend le focus à sa commande. Un clic extérieur ou le choix d’un lien ferme le panneau. Les liens et commandes possèdent un focus visible.

La procédure `docs/boussole-maintenance.md` a été consultée. Les états EMPTY, POPULATED et FOCUSED, les étapes, les fallbacks et leurs versions restent identiques. Aucun `journeyVersion` n’est modifié : seuls la présentation et le rangement des accès changent.

Les anciens `data-boussole-id` de navigation sont conservés sur les vrais liens. `open-dashboard` est porté par le lien logo/Accueil ; `open-governance` par Mes espaces ; `dashboard-menu` reste sur la navigation de Dashboard.

Pour les liens secondaires, la disponibilité peut reconnaître une divulgation de navigation fermée. « Montrer la zone » ouvre ses ancêtres de présentation avant de mesurer et entourer le lien. Il ne clique pas, ne navigue pas et ne crée aucune donnée. Les divulgations métier non marquées et les éléments masqués par `hidden`, `aria-hidden` ou CSS ne sont pas rendus disponibles par ce mécanisme. Les objets métier et les conditions d’état ne changent pas.

## I. Tests

| Vérification | Résultat |
| --- | --- |
| Tous les tests `qa/*.test.ts` de premier niveau | **545 réussis, 0 échec** |
| Suite ConnectedShell incluse ci-dessus | Frontière A/B/C, 46 URL de pages et 84 handlers inchangés, shell unique, trois portes et conservation des 16 destinations |
| Nouvelle suite `qa/navigation-disclosure.test.ts` | **6 réussis** : liens dans menus fermés, révélation sans activation, exclusion des divulgations métier, éléments masqués et cibles ordinaires |
| `npm.cmd run qa:ux-01a-hardening` | **33 réussis** |
| `npm.cmd run qa:boussole-maintenance` | **54 réussis**, toutes les sous-suites exécutées |
| Autres suites Boussole, navigation, auth, candidat, gouvernance et feedback | Incluses dans les 545 tests réussis |
| `npm.cmd run qa:connected-navigation` | **5 scénarios Chrome réussis** : 320, 390, 768, 1024 et 1440 px |
| Comparaison à la capture UX-01A.1 | Aucun fichier de `app/` changé, aucune route déplacée, aucun fichier supprimé |
| `git diff --check` | Réussi |

Chaque scénario Chrome utilise les vrais composants interactifs compilés en mémoire et le vrai CSS. Il vérifie : une seule navigation, trois liens visibles, absence de débordement, dimensions du header, clavier Entrée/Espace/Tab/Échap, focus visible, Identité/Paramètres, dix accès secondaires, fermeture sur sélection, état actif souligné, navigation des trois portes et d’Accueil, révélation Boussole sans navigation, langue, déconnexion et absence de collision avec une notification affichée.

Le script réutilise TypeScript, React et Tailwind installés : aucune dépendance ajoutée. Il lance Chromium sans fenêtre, avec un profil temporaire, et fonctionne sans serveur applicatif ni données métier. `GOODISSIMA_CHROME` permet de fournir le chemin d’un navigateur compatible.

Limites : le routeur, l’authentification et la traduction sont simulés dans le test navigateur ; il ne s’agit pas d’une recette avec Supabase/PostgreSQL. ContextualBoussole est couvert par ses suites existantes et le test de divulgation ; ses panneaux complets et les modales Feedback sur données réelles restent à valider humainement.

## J. Build et comparaison UX-01A.1

`npm.cmd run build` exécuté une fois, après les changements de composants. Compilation des modules réussie, puis arrêt sur la dette préexistante connue :

```text
app/api/documents/upload/route.ts:128:27
Property 'get' does not exist on type 'FormData'.
```

La dette n’est pas corrigée. `tsconfig.tsbuildinfo` est restauré et comparé à sa sauvegarde.

Le typage applicatif utilise les options du projet, avec les mêmes exclusions comparatives `.next/` et `m1a/` qu’en UX-01A.1. Une capture avant UX-01A.2 donne **2 diagnostics** ; le contrôle après donne **2 diagnostics identiques, aucun ajouté** : TS2352 dans `qa/candidate-form-safety.test.ts` et TS7023 dans `qa/matching-lifecycle.test.ts`.

Aucun nouveau diagnostic dans les composants, le helper Boussole ou les tests du lot. Le build global n’est pas déclaré réussi.

## K. Risques et dettes restantes

- « Mes espaces » conduit provisoirement à une page encore intitulée Gouvernance ; cette terminologie métier n’est pas refondue ici.
- Les dix fonctions secondaires demandent l’ouverture d’Utilisateur puis d’Autres accès. Ce rangement préserve leur accessibilité pendant la migration, mais reste temporaire.
- La visibilité inconditionnelle d’Administration demeure une dette connue ; les contrôles serveur restent inchangés.
- Le build global reste bloqué par la dette `FormData.get` et les diagnostics de tests antérieurs restent hors périmètre.
- Recette humaine nécessaire avec sessions réelles, pages candidates avec et sans session propriétaire, et états Boussole EMPTY/POPULATED/FOCUSED. Les modales et les panneaux flottants complets ne sont pas refondus dans ce lot.

Risque estimé : **intermédiaire**, principalement pour la découverte des accès secondaires et la recette en environnement réel.

## L. Diff résumé

Fichiers modifiés par rapport à UX-01A.1 :

```text
components/ConnectedShell.tsx
components/PlatformNavigation.tsx
components/ContextualBoussole.tsx
package.json
qa/app-ux-integration.test.ts
qa/boussole-navigation-integration.test.ts
qa/connected-shell.test.ts
qa/helpers/render-connected-shell.ts
```

Fichiers créés :

```text
lib/boussole/navigation-disclosure.ts
qa/navigation-disclosure.test.ts
scripts/qa-connected-navigation.mjs
docs/ux-01a2-navigation-globale.md
```

Trois composants adaptés, un petit helper de présentation Boussole, tests et documentation. Les modifications des lots UX-01A.0/UX-01A.1 déjà présentes restent conservées, sans être attribuées à ce lot. Aucun changement de page, layout App Router, middleware, autorisation, API, migration, dépendance ou URL. Aucun commit ni push.

UX-01A.2 :

- [ ] prêt
- [x] prêt avec réserves
- [ ] bloqué
