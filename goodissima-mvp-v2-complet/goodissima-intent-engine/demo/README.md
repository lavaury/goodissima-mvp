# Démonstration Merge Goodissima

Cette démonstration présente un rapprochement déterministe entre des dossiers
CIRO déjà constitués. Elle n'utilise ni détection de texte, ni inférence, ni
raisonnement IA.

## Lancer la démonstration

Depuis le répertoire `goodissima-intent-engine` :

```bash
npm run demo
```

La commande historique ciblée reste également disponible :

```bash
npm run demo:merge:housing
npm run demo:merge:employment
```

`npm run demo` affiche successivement les scénarios logement et emploi. Avant
tout affichage, la commande compile le projet et valide les fixtures CIRO,
leurs sources de connaissance, les libellés français et la
configuration de score. Une fixture invalide interrompt la démonstration.

## Scénario

Le demandeur est un **locataire recherchant une location**. Trois opportunités
CIRO lui sont soumises :

1. un **propriétaire proposant une location** avec les mêmes valeurs CIRO ;
2. un **second locataire**, représenté par une fixture immobilière distincte ;
3. un **profil emploi non lié**, sans entrée compatible dans la matrice.

Les candidats sont évalués exclusivement par `evaluateMerge`, qui utilise le
moteur `scoreMerge` existant. La couche de présentation traduit ensuite les
statuts et les dimensions du score en français sans modifier le résultat.

## Scénario emploi

Le demandeur est un **candidat recherchant un emploi**. Les opportunités sont :

1. un **recruteur / employeur** avec les mêmes valeurs CIRO ;
2. un **second candidat** du même domaine, mais avec des rôles et une politique différents ;
3. un **profil logement non lié**, absent de la paire compatible attendue.

Avec le score existant, le recruteur obtient 100 %, le second candidat 50 % et
le profil logement `Aucune correspondance`.

## Extrait attendu

```text
─────────────────────────────

Demandeur :
Locataire recherchant une location

Opportunités détectées

1. Propriétaire
   Correspondance parfaite
   Score relationnel : 100 %

2. Locataire
   Compatibilité faible
   Score relationnel : 25 %

3. Recherche d'emploi
   Aucune correspondance

─────────────────────────────
```

Les pourcentages proviennent directement des quatre dimensions binaires du
score gouverné. Aucun score de remplacement ou rapprochement implicite n'est
appliqué.
