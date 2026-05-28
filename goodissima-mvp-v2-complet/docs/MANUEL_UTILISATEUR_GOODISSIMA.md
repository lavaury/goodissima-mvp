# Manuel utilisateur Goodissima

Version produit : v0.9  
Dernière mise à jour : 2026-05-27  

Compatibilité :

- AI Workspace V1
- Relation Studio V2
- Matching V2
- Analytics V1
- Governance Center V1

Historique documentaire :

| Version | Date | Évolution |
| --- | --- | --- |
| v0.9 | 2026-05-27 | Version premium enrichie : concepts, gouvernance, diagrammes, architecture simplifiée, enterprise-ready et glossaire. |

Goodissima est une plateforme relationnelle sécurisée, contextualisée et augmentée par une IA gouvernée. Elle permet de créer des parcours relationnels, de partager des liens sécurisés, de centraliser les échanges et d'accompagner la décision humaine avec des suggestions explicables.

L'IA Goodissima n'agit pas seule. Elle suggère, résume, contextualise, détecte des signaux et génère des brouillons. L'humain décide toujours. Aucun message, contact, email, refus, validation, partage d'identité ou action sensible n'est appliqué automatiquement.

## Table des matières

1. [Principes à retenir](#1-principes-a-retenir)
2. [Concepts clés Goodissima](#2-concepts-cles-goodissima)
3. [Philosophie IA Goodissima](#3-philosophie-ia-goodissima)
4. [Diagrammes relationnels](#4-diagrammes-relationnels)
5. [Architecture simplifiée](#5-architecture-simplifiee)
6. [Accueil](#6-accueil)
7. [Connexion et dashboard](#7-connexion-et-dashboard)
8. [Mes liens sécurisés](#8-mes-liens-securises)
9. [Relation Studio](#9-relation-studio)
10. [Création de parcours](#10-creation-de-parcours)
11. [Publication et versioning](#11-publication-et-versioning)
12. [Création de lien et QR code](#12-creation-de-lien-et-qr-code)
13. [Espace candidat](#13-espace-candidat)
14. [Conversation sécurisée](#14-conversation-securisee)
15. [Documents](#15-documents)
16. [Demandes relationnelles](#16-demandes-relationnelles)
17. [AI Workspace](#17-ai-workspace)
18. [Résumé IA](#18-resume-ia)
19. [Timeline IA](#19-timeline-ia)
20. [Signaux IA](#20-signaux-ia)
21. [Matching gouverné](#21-matching-gouverne)
22. [Brouillons IA](#22-brouillons-ia)
23. [Analytics](#23-analytics)
24. [Paramètres](#24-parametres)
25. [Centre de gouvernance IA](#25-centre-de-gouvernance-ia)
26. [Gouvernance et sécurité](#26-gouvernance-et-securite)
27. [Explainability UX](#27-explainability-ux)
28. [Utilisation organisationnelle](#28-utilisation-organisationnelle)
29. [Bonnes pratiques](#29-bonnes-pratiques)
30. [Questions fréquentes](#30-questions-frequentes)
31. [Glossaire relationnel](#31-glossaire-relationnel)
32. [Captures disponibles et captures attendues](#32-captures-disponibles-et-captures-attendues)

<a id="1-principes-a-retenir"></a>

## 1. Principes à retenir

Goodissima repose sur des principes simples, visibles dans l'expérience produit et cohérents avec les documents de gouvernance IA et matching.

| Principe | Ce que cela signifie pour l'utilisateur |
| --- | --- |
| Privacy-first | Les données sont limitées au besoin relationnel et les contextes IA sont minimisés. |
| Human-in-the-loop | L'utilisateur valide les actions sensibles. L'IA ne décide pas seule. |
| Explainability-first | Les suggestions sont accompagnées d'explications lisibles. |
| Aucun contact automatique | Goodissima ne contacte pas une personne sans action humaine. |
| Aucune décision automatique | Aucun dossier n'est validé, refusé, bloqué ou clos par l'IA. |
| Aucun score opaque visible | Le matching affiche des raisons, pas un score brut présenté comme vérité. |
| Matching opt-in | Un dossier doit être explicitement activé pour le matching. |
| Pseudonymisation | Les correspondances ne révèlent pas automatiquement l'identité. |
| Auditabilité | Les usages IA et les actions humaines importantes sont tracés. |

<a id="2-concepts-cles-goodissima"></a>

## 2. Concepts clés Goodissima

### Relation sécurisée

Une relation sécurisée est un échange encadré dans Goodissima : un lien, un contexte, un dossier, des messages, des documents et des actions suivies. L'objectif est de remplacer les échanges dispersés par un espace clair et protégé.

### Parcours relationnel

Un parcours relationnel définit les informations demandées au candidat. Il peut comporter plusieurs étapes, des champs obligatoires, des règles conditionnelles et des validations. Il est géré dans Relation Studio.

### Dossier relationnel

Le dossier relationnel centralise une demande réelle : conversation, documents, demandes, activité récente, audit, matching opt-in et AI Workspace côté propriétaire.

### RelationCase

`RelationCase` est le nom technique du dossier relationnel dans le code. Dans l'interface, il correspond au dossier ouvert après la soumission d'un candidat.

### AI Workspace

L'AI Workspace est l'espace d'intelligence relationnelle du propriétaire. Il regroupe Résumé IA, Timeline IA, Signaux IA, Matching et Brouillons IA.

### Résumé IA

Le Résumé IA synthétise le dossier, met en avant des points clés, signale des risques, liste des documents manquants et peut proposer des actions à valider manuellement.

### Timeline IA

La Timeline IA analyse la dynamique du dossier : état relationnel, inactivité, blocages, alertes et prochaines actions possibles.

### Signaux IA

Les Signaux IA sont des points de vigilance contextualisés. Ils ne sont pas un verdict et ne bloquent jamais un dossier.

### Matching gouverné

Le matching gouverné suggère des correspondances potentielles entre dossiers opt-in. Les résultats sont pseudonymisés, explicables et sans score brut visible.

### Brouillons IA

Les Brouillons IA aident à préparer une réponse. Ils peuvent être copiés ou placés dans l'éditeur, mais l'envoi reste manuel.

### Audit

L'audit rend les actions importantes traçables : événements relationnels, usages IA, propositions acceptées, actions humaines et journaux récents.

### Consentement

Le consentement intervient dans les demandes relationnelles et dans les préférences d'usage, notamment pour le matching opt-in et certaines notifications.

### Relation Studio

Relation Studio est l'atelier de conception et de publication des parcours relationnels.

### Gouvernance IA

La gouvernance IA regroupe les règles qui encadrent l'usage de l'IA : transparence, supervision humaine, minimisation des données, absence d'automatisation sensible et auditabilité.

<a id="3-philosophie-ia-goodissima"></a>

## 3. Philosophie IA Goodissima

### IA gouvernée Goodissima

Goodissima utilise l'IA comme copilote relationnel. Elle aide à mieux comprendre une situation, à préparer une réponse ou à identifier des points de vigilance. Elle ne remplace pas le jugement humain.

Règles fondamentales :

- L'IA suggère.
- L'humain décide.
- Aucun message n'est envoyé automatiquement.
- Aucun contact automatique n'est déclenché.
- Aucun scoring caché n'est visible dans l'interface.
- Les correspondances sont pseudonymisées.
- Les actions IA sont auditables.
- Les données sensibles sont protégées.
- Les suggestions IA doivent être validées.
- Les documents restent privés.

### Explainability-first

Goodissima privilégie les explications plutôt que les verdicts. Un résultat IA doit être compréhensible : pourquoi ce point est important, quelle information manque, quelle action pourrait être utile.

Dans le matching, cela se traduit par des éléments compatibles, des signaux relationnels, des clarifications nécessaires et des avertissements. Aucun score brut n'est affiché à l'utilisateur.

### Human-in-the-loop

L'humain reste dans la boucle à chaque étape sensible. Une suggestion d'action ne devient une demande que si l'utilisateur l'accepte. Un brouillon IA ne part jamais sans envoi manuel. Une proposition de matching ne contacte personne automatiquement.

### Auditabilité

Les traitements IA et les acceptations humaines sont journalisés. Le Centre de gouvernance IA affiche un journal récent et le dossier relationnel dispose d'une zone d'audit.

### Matching opt-in

Le matching est désactivé par défaut. Il doit être activé explicitement sur un dossier. Côté candidat, l'option est formulée comme une volonté d'être considéré pour des opportunités compatibles.

### Privacy-first

Goodissima limite les données envoyées aux contextes IA. Les emails, tokens, URLs privées et secrets sont exclus ou remplacés dans les traitements IA documentés par la gouvernance.

<a id="4-diagrammes-relationnels"></a>

## 4. Diagrammes relationnels

### Flux relationnel

```text
Parcours relationnel
↓
Lien sécurisé
↓
Entrée candidat
↓
Dossier relationnel
↓
Conversation sécurisée
↓
Documents
↓
AI Workspace
↓
Validation humaine
```

Ce flux représente l'usage principal : une organisation prépare un parcours, partage un lien, reçoit une demande, échange dans un dossier sécurisé, puis utilise l'IA comme aide à la compréhension et au suivi.

### Flux IA gouverné

```text
Données dossier
↓
Analyse IA
↓
Résumé / Timeline / Signaux / Matching
↓
Validation humaine
↓
Action éventuelle
↓
Audit AIEvent
```

L'IA intervient comme étape d'analyse. Elle ne finalise pas la relation et ne déclenche pas l'action sensible. La validation humaine reste le point de passage obligatoire.

### Séparation public / privé

```text
Lien public candidat
↓
Formulaire sécurisé
↓
Token d'accès candidat
↓
Espace candidat limité

Dashboard propriétaire
↓
Dossier complet
↓
AI Workspace / Audit / Accès
```

Le candidat accède uniquement à son espace sécurisé. Le propriétaire dispose d'une vue plus complète pour piloter le dossier, gérer les demandes, utiliser l'IA et contrôler l'accès.

<a id="5-architecture-simplifiee"></a>

## 5. Architecture simplifiée

```text
Navigateur
↓
Next.js / Vercel
↓
API sécurisées
↓
Prisma serveur
↓
Supabase PostgreSQL
↓
Storage privé
```

Cette vue simplifiée décrit l'architecture fonctionnelle observée dans le projet : interface Next.js, routes API, accès serveur via Prisma, base Supabase/PostgreSQL et documents servis via mécanismes sécurisés, notamment des liens signés.

Le détail technique complet n'est pas nécessaire pour utiliser Goodissima. L'idée essentielle : les espaces publics, privés et candidats sont séparés, et les actions sensibles passent par des API contrôlées.

<a id="6-accueil"></a>

## 6. Accueil

L'accueil présente Goodissima comme une plateforme de relation sécurisée contextualisée. Il oriente l'utilisateur vers deux actions principales : créer un lien sécurisé ou ouvrir le dashboard.

![Accueil Goodissima](images/Accueil%20G%2027052026.png)

Légende : page d'accueil Goodissima avec les deux entrées principales, création de lien et dashboard.

Depuis cet écran, vous pouvez :

- créer un nouveau lien sécurisé pour un contexte précis ;
- accéder au tableau de bord de vos liens et dossiers ;
- comprendre le principe général : créer, filtrer, échanger.

<a id="7-connexion-et-dashboard"></a>

## 7. Connexion et dashboard

La connexion se fait via la page conseiller. L'utilisateur renseigne son email et son mot de passe. La page prévoit aussi un lien de réinitialisation de mot de passe et un lien de création d'accès.

Après connexion, Goodissima ouvre le dashboard, nommé dans l'interface "Mes liens sécurisés".

![Dashboard Goodissima](images/Dashboard%20G%2027052026.png)

Légende : dashboard des liens sécurisés avec indicateurs, activité récente, filtres et cartes de liens.

Le dashboard permet de :

- consulter les liens créés ;
- suivre les dossiers actifs, prioritaires, urgents, clôturés ou archivés ;
- voir l'activité récente : nouveaux dossiers, messages, documents ;
- rechercher un lien, une ville, un slug ou un email candidat ;
- filtrer les liens par statut ;
- créer un nouveau lien ;
- ouvrir un dossier relationnel existant.

<a id="8-mes-liens-securises"></a>

## 8. Mes liens sécurisés

Chaque carte de lien affiche le contexte du lien, son URL publique candidat, le parcours associé et, si disponible, la version du parcours utilisée.

Depuis une carte, l'utilisateur peut :

- copier le lien public ;
- partager le lien ;
- tester le parcours candidat ;
- ouvrir le dossier lorsqu'un candidat a répondu ;
- télécharger ou afficher le QR code.

Les filtres du dashboard aident à retrouver rapidement les liens actifs, en attente, prioritaires, urgents, clôturés ou archivés.

<a id="9-relation-studio"></a>

## 9. Relation Studio

Relation Studio est l'espace de gestion des parcours. Un parcours définit les informations demandées au candidat, les étapes, les règles conditionnelles, les validations et les instructions IA associées.

![Relation Studio](images/Relation%20Studio%20G%2027052026.png)

Légende : liste des parcours disponibles dans Relation Studio, avec statut, version active et nombre de liens.

Depuis Relation Studio, vous pouvez :

- consulter les parcours existants ;
- voir leur statut : brouillon, publié ou archivé ;
- créer un lien à partir d'un parcours ;
- ouvrir un parcours pour le tester, le vérifier ou le modifier ;
- créer un nouveau parcours.

<a id="10-creation-de-parcours"></a>

## 10. Création de parcours

La création ou l'édition d'un parcours sert à structurer l'expérience candidat. Le parcours peut être composé de plusieurs étapes, avec des champs obligatoires, des options, des règles conditionnelles et des validations.

![Nouveau parcours](images/Relation%20Studio%20Nouveau%20Parcours%2027052026.png)

Légende : écran de création ou configuration d'un nouveau parcours relationnel.

Exemples d'écrans de parcours :

![Parcours exemple 1](images/Exemple%20Parcours%20G%201%2027052026.png)

Légende : exemple de parcours avec champs et structure d'étapes.

![Parcours exemple 2](images/Exemple%20Parcours%20G%202%2027052026.png)

Légende : exemple de configuration de parcours avec informations attendues du candidat.

![Parcours exemple 3](images/Exemple%20Parcours%20G%203%2027052026.png)

Légende : exemple de section de parcours et de champs contextualisés.

![Parcours exemple 4](images/Exemple%20Parcours%20G%204%2027052026.png)

Légende : exemple de paramétrage avancé de parcours.

![Parcours exemple 5](images/Exemple%20Parcours%20G%205%2027052026.png)

Légende : exemple de parcours avec règles ou informations de validation.

![Parcours exemple 6](images/Exemple%20Parcours%20G%206%2027052026.png)

Légende : exemple de parcours prêt à être vérifié avant publication.

![Parcours exemple 7](images/Exemple%20Parcours%20G%207%2027052026.png)

Légende : exemple de parcours dans une configuration avancée.

<a id="11-publication-et-versioning"></a>

## 11. Publication et versioning

Un parcours peut être publié depuis sa page détail. La publication crée une version figée du parcours.

Ce principe est important :

- les liens déjà créés continuent d'utiliser leur version publiée ;
- les nouveaux liens utilisent la version active la plus récente ;
- l'historique des versions reste visible ;
- les changements de parcours n'altèrent pas silencieusement les liens existants.

Cette logique protège les dossiers en cours. Un candidat qui répond à un lien donné conserve le parcours attendu au moment de la création du lien.

<a id="12-creation-de-lien-et-qr-code"></a>

## 12. Création de lien et QR code

La création d'un lien se fait depuis le dashboard ou Relation Studio. L'utilisateur renseigne :

- un titre ;
- une ville ou un contexte géographique si utile ;
- une description ;
- le parcours à utiliser ;
- les options de collecte, comme email requis, message requis ou document autorisé.

Avant génération, Goodissima affiche un aperçu du parcours candidat : étapes, champs principaux et règles importantes.

Une fois créé, le lien public peut être copié, partagé, testé ou transformé en QR code depuis le dashboard.

### QR code

Le QR code permet de partager un lien sans transmettre directement un numéro de téléphone ou une adresse email personnelle. Il peut être affiché ou téléchargé depuis la carte du lien.

Bon usage :

- l'imprimer sur un support physique ;
- l'afficher lors d'un rendez-vous ;
- le partager dans un contexte où l'utilisateur souhaite recevoir une demande sécurisée sans exposer ses coordonnées directes.

<a id="13-espace-candidat"></a>

## 13. Espace candidat

Le candidat accède au lien public. Il voit le contexte de la demande, remplit le formulaire et peut, selon le parcours, ajouter un message, des informations structurées et des documents.

![Espace candidat](images/Candidat%20G%2027052026.png)

Légende : espace candidat avec parcours sécurisé, formulaire contextualisé et options de notification.

Selon le parcours configuré, l'espace candidat peut inclure :

- des champs texte, email, nombre, choix ou fichier ;
- plusieurs étapes avec progression ;
- des règles conditionnelles ;
- une option de notification email ;
- l'ajout de documents ou liens documentaires.

Lorsque le candidat soumet sa demande, Goodissima crée un dossier relationnel sécurisé et redirige vers l'espace de conversation sécurisée.

<a id="14-conversation-securisee"></a>

## 14. Conversation sécurisée

La conversation sécurisée centralise les échanges entre le propriétaire et le candidat. Les messages sont horodatés et protégés dans le contexte du dossier.

![Conversation sécurisée](images/Conversation%20G%2027052026.png)

Légende : espace relationnel avec conversation, documents, matching, demandes, activité récente et audit.

Dans cet espace, vous pouvez :

- envoyer et recevoir des messages ;
- consulter les nouveaux messages sans quitter le dossier ;
- ajouter des documents ;
- suivre les demandes relationnelles ;
- activer ou désactiver le matching opt-in ;
- consulter l'activité récente ;
- consulter l'audit du dossier ;
- utiliser l'AI Workspace côté propriétaire.

Le candidat dispose aussi d'une vue sécurisée, limitée à son dossier, via un token d'accès. L'accès peut être révoqué ou régénéré côté propriétaire.

<a id="15-documents"></a>

## 15. Documents

Les documents sont partagés dans le même contexte que la conversation. Goodissima accepte les fichiers jusqu'à 10 Mo. Sur mobile, l'utilisateur peut prendre une photo, choisir une image existante ou ajouter un PDF/fichier. Sur desktop, il peut ajouter PDF, DOC, DOCX ou image.

Les documents sont ouverts via des liens signés. Cela évite d'exposer directement des fichiers publics permanents.

Bonnes pratiques :

- nommer les fichiers clairement ;
- éviter les doublons ;
- ne partager que les pièces utiles au dossier ;
- vérifier le bon dossier avant ajout.

<a id="16-demandes-relationnelles"></a>

## 16. Demandes relationnelles

Les demandes relationnelles structurent les actions attendues dans un dossier. Elles peuvent être créées par le propriétaire ou provenir d'une suggestion IA acceptée par un humain.

Types de demandes supportés par le produit :

- demande de document ;
- consentement ;
- validation ;
- tâche.

Le propriétaire peut créer une demande, la décrire et la marquer comme terminée. Le candidat voit les demandes non terminées et peut les marquer comme faites, accepter ou valider selon le type.

Important : une suggestion IA ne devient une demande qu'après validation humaine.

<a id="17-ai-workspace"></a>

## 17. AI Workspace

L'AI Workspace est disponible dans le dossier relationnel côté propriétaire. Il regroupe cinq onglets :

- Résumé IA ;
- Timeline IA ;
- Signaux IA ;
- Matching ;
- Brouillons IA.

![AI Workspace - Résumé IA](images/Conversation%20G%20AI%20Workspace%20Resume%20IA%2027052026.png)

Légende : AI Workspace avec génération d'un résumé relationnel explicable.

L'AI Workspace est gouverné par ces règles :

- l'IA produit des suggestions, pas des décisions ;
- aucune action n'est créée sans clic humain ;
- aucun message n'est envoyé automatiquement ;
- les sorties IA indiquent le fournisseur et le modèle lorsque disponible ;
- les usages importants sont audités.

<a id="18-resume-ia"></a>

## 18. Résumé IA

Le Résumé IA peut générer une synthèse du dossier. Il peut afficher :

- un résumé ;
- des points clés ;
- des risques ;
- des documents manquants ;
- des suggestions d'actions.

L'utilisateur peut copier le résumé. Lorsqu'une action est suggérée, elle n'est créée que si l'utilisateur clique explicitement sur le bouton de création.

<a id="19-timeline-ia"></a>

## 19. Timeline IA

La Timeline IA analyse l'état relationnel du dossier.

![AI Workspace - Timeline IA](images/Conversation%20G%20AI%20Workspace%20Timeline%20IA.png)

Légende : analyse de timeline avec état relationnel, alertes, blocages et prochaines actions recommandées.

Elle peut mettre en avant :

- l'état relationnel ;
- une inactivité ;
- des blocages ;
- des alertes ;
- des prochaines actions recommandées.

Une action recommandée peut être créée ou ignorée. Dans tous les cas, le choix appartient à l'utilisateur.

<a id="20-signaux-ia"></a>

## 20. Signaux IA

Les Signaux IA de confiance identifient des points de vigilance contextualisés.

![AI Workspace - Signaux IA](images/Conversation%20G%20AI%20Workspace%20Signaux%20IA%2027052026.png)

Légende : signaux IA explicables avec sévérité, type, explication et recommandation.

Chaque signal peut contenir :

- une sévérité lisible : low, medium ou high ;
- un type ;
- un titre ;
- une explication ;
- une recommandation optionnelle.

Il ne s'agit pas d'un score global et l'IA ne bloque jamais un dossier. L'utilisateur peut indiquer qu'il a pris un signal en compte, ce qui est audité.

<a id="21-matching-gouverne"></a>

## 21. Matching gouverné

Le matching relationnel propose des correspondances potentielles uniquement lorsque le dossier est opt-in.

![AI Workspace - Matching](images/Conversation%20G%20AI%20Workspace%20Matching%2027052026.png)

Légende : matching gouverné avec correspondances pseudonymisées, explications et proposition relationnelle manuelle.

Le matching Goodissima affiche :

- des correspondances pseudonymisées ;
- des éléments compatibles ;
- des signaux relationnels ;
- des clarifications nécessaires ;
- des warnings.

Il n'affiche pas de score brut, ne révèle pas automatiquement l'identité et ne contacte personne automatiquement. Le bouton "Proposer une relation" crée une suggestion relationnelle auditée, pas une mise en relation directe.

L'opt-in matching est visible dans la colonne latérale du dossier. Côté candidat, le libellé indique qu'il souhaite être considéré pour des opportunités compatibles.

<a id="22-brouillons-ia"></a>

## 22. Brouillons IA

Les Brouillons IA aident à préparer une réponse.

![AI Workspace - Brouillons IA](images/Conversation%20G%20AI%20Workspace%20Brouillons%20IA%2027052026.png)

Légende : assistant de rédaction IA avec type de brouillon, consigne optionnelle et actions de copie ou insertion dans l'éditeur.

Types de brouillons disponibles :

- relance ;
- demande de document ;
- demande de clarification ;
- réponse investisseur ;
- réponse professionnelle.

L'utilisateur peut copier le brouillon ou le placer dans l'éditeur de conversation. Le message n'est pas envoyé automatiquement. Il doit être relu puis envoyé manuellement.

<a id="23-analytics"></a>

## 23. Analytics

La page Analytics donne une vue d'ensemble de l'activité relationnelle.

![Analytics Goodissima](images/Analytics%20Gpng.png)

Légende : analytics avec indicateurs globaux, funnel, activité et performance par parcours.

Elle affiche notamment :

- les relations actives ;
- les nouveaux dossiers ;
- les demandes ouvertes ;
- le nombre de documents ;
- le temps moyen de réponse ;
- les dossiers finalisés ;
- un funnel relationnel ;
- l'activité récente ;
- la performance des parcours.

Les analytics aident à piloter les parcours et les dossiers. Ils ne remplacent pas l'analyse humaine d'un dossier individuel.

<a id="24-parametres"></a>

## 24. Paramètres

La page Paramètres regroupe la gouvernance, l'organisation, la sécurité et les préférences de notification.

![Paramètres Goodissima](images/Param%C3%A8tres%20G%2027052026.png)

Légende : paramètres Goodissima avec centre de gouvernance IA, préférences organisationnelles, sécurité et notifications.

L'interface présente :

- le nom d'organisation ;
- le logo ou l'identité de marque ;
- les couleurs ;
- certaines préférences de sécurité ;
- les notifications email ;
- les notifications de messages, documents, demandes et validations ;
- la privacy relationnelle ;
- la pseudonymisation.

Dans l'état actuel du code, l'enregistrement côté serveur concerne les préférences de notifications et de privacy. Les champs d'organisation, branding et sécurité sont visibles dans l'interface de paramétrage, mais leur persistance applicative complète n'est pas exposée dans les routes inspectées.

<a id="25-centre-de-gouvernance-ia"></a>

## 25. Centre de gouvernance IA

Le Centre de gouvernance IA est intégré en haut de la page Paramètres.

Il affiche :

- le provider IA actif ;
- le modèle actif ;
- les principes IA Goodissima ;
- le nombre de scénarios QA IA disponibles ;
- un journal IA récent.

Principes affichés dans l'interface :

- l'IA suggère, l'humain décide ;
- aucune décision automatique ;
- aucune action automatique ;
- aucune donnée sensible inutile envoyée ;
- emails, tokens et URLs privées exclus ;
- actions IA auditées.

Ce centre donne une visibilité opérationnelle sur l'IA. Il ne sert pas à déléguer des décisions à l'IA.

<a id="26-gouvernance-et-securite"></a>

## 26. Gouvernance et sécurité

Goodissima sépare les espaces publics, privés et candidats. Cette séparation permet de partager un lien sans exposer un espace complet, puis de limiter chaque accès au bon contexte relationnel.

### Signed URLs

Les documents sont ouverts via des liens signés. Un lien signé permet d'accéder à un document de manière contrôlée, sans rendre le fichier public de façon permanente.

### Tokens sécurisés

L'espace candidat utilise un token d'accès. Ce token permet au candidat de revenir dans son espace sécurisé. Le propriétaire peut révoquer ou régénérer cet accès.

### Stockage privé

Les documents sont ajoutés dans le contexte du dossier et récupérés via les routes sécurisées du produit. L'utilisateur n'a pas à exposer directement un fichier public.

### Consentement

Goodissima privilégie les préférences explicites : notifications, demandes de consentement et matching opt-in. Le consentement est traité comme une action relationnelle, pas comme un automatisme caché.

### Pseudonymisation

Dans le matching, les correspondances sont affichées sous forme pseudonymisée. Le produit ne révèle pas automatiquement le nom, l'email, le token ou l'identité complète d'un dossier cible.

### Expiration et révocation des accès

Le propriétaire dispose d'un panneau d'accès candidat dans le dossier. Il peut contrôler l'accès, notamment via révocation ou régénération du token.

### Validation humaine

Les suggestions IA, les actions relationnelles et les propositions de matching ne remplacent pas une validation humaine. Goodissima aide à organiser la décision ; il ne décide pas à la place de l'utilisateur.

### Journal et audit

Goodissima conserve des événements relationnels et des événements IA.

| Journal | Rôle |
| --- | --- |
| AIEvent | Trace les usages IA : résumé, timeline, signaux, brouillons, matching, propositions. |
| RelationEvent | Trace les événements du dossier : messages, documents, demandes, changements importants. |
| Audit du dossier | Donne une lecture humaine des événements utiles dans l'espace relationnel. |
| Journal IA récent | Affiche les événements IA récents dans le Centre de gouvernance IA. |

Cette traçabilité sert à comprendre ce qui s'est passé, quand et dans quel contexte. Elle soutient la supervision humaine et la gouvernance, sans transformer l'IA en autorité automatique.

<a id="27-explainability-ux"></a>

## 27. Explainability UX

### Pourquoi l'IA affiche ces informations ?

Goodissima affiche des informations IA pour aider l'utilisateur à mieux comprendre un dossier, pas pour imposer une conclusion.

Les signaux visibles aident à repérer une vigilance possible : information incohérente, document manquant, contexte incomplet ou besoin de clarification. Chaque signal doit être lu comme une invitation à vérifier.

Les recommandations sont contextualisées. Elles peuvent proposer une relance, une demande de document ou une clarification, mais elles ne créent rien sans clic humain.

L'absence de score caché visible protège l'utilisateur contre une lecture trop mécanique de la relation. Le produit préfère montrer des raisons : ce qui semble compatible, ce qui manque, ce qui mérite attention.

Lorsque les informations sont insuffisantes, l'IA peut produire un état vide, un avertissement ou une recommandation de clarification. C'est un comportement attendu : mieux vaut signaler une limite que produire une certitude artificielle.

<a id="28-utilisation-organisationnelle"></a>

## 28. Utilisation organisationnelle

Goodissima peut être utilisé par une organisation qui souhaite structurer plusieurs contextes relationnels : immobilier, investissement, recrutement, partenariat, relation bancaire ou autre contexte nécessitant confidentialité et suivi.

### Équipes et workflows relationnels

Le dashboard donne une vue des liens et dossiers. Relation Studio permet de standardiser les parcours. Les dossiers centralisent les conversations, documents, demandes et audits.

### Publication de parcours

La publication crée une version figée. Cette logique est utile en organisation : un parcours validé peut être utilisé par plusieurs liens sans être modifié silencieusement après partage.

### Versions figées

Les liens existants continuent d'utiliser leur version publiée. Les nouveaux liens utilisent la version active. Cela facilite le contrôle qualité et la compréhension de ce qu'un candidat a vu au moment de sa réponse.

### Audit et conformité

Le Centre de gouvernance IA, le journal récent, l'audit de dossier et les événements relationnels fournissent une base de traçabilité. Goodissima ne revendique pas une certification réglementaire automatique ; il propose une architecture orientée gouvernance, à compléter selon le cadre légal et conformité de chaque déploiement.

### Confidentialité multi-contextes

Chaque lien correspond à un contexte. Chaque dossier correspond à une relation. Cette séparation évite de mélanger les échanges et aide les équipes à travailler avec des informations contextualisées.

<a id="29-bonnes-pratiques"></a>

## 29. Bonnes pratiques

Créer un lien par contexte précis. Un lien clair facilite le tri des demandes et évite les conversations mélangées.

Publier les parcours avant usage important. La publication fige une version et protège les liens déjà créés.

Vérifier l'aperçu candidat. Avant de partager un lien, testez le parcours pour confirmer les champs, les étapes et les règles.

Utiliser les demandes relationnelles pour structurer le suivi. Une demande de document, de consentement, de validation ou une tâche est plus facile à suivre qu'un message libre oublié dans une conversation.

Lire les sorties IA comme des aides. Un résumé, un signal ou un brouillon doit toujours être relu et contextualisé.

Ne pas partager de données inutiles. Ajoutez uniquement les documents et informations nécessaires au dossier.

Activer le matching seulement quand c'est pertinent. Le matching est opt-in et doit rester cohérent avec le contexte relationnel.

Relire les brouillons IA avant envoi. L'IA peut aider au ton et à la structure, mais l'utilisateur reste responsable du message final.

Surveiller l'audit et l'activité récente. Ces sections aident à comprendre ce qui s'est passé dans un dossier.

<a id="30-questions-frequentes"></a>

## 30. Questions fréquentes

### L'IA peut-elle envoyer un message automatiquement ?

Non. Les brouillons IA peuvent être copiés ou placés dans l'éditeur, mais l'utilisateur doit envoyer le message lui-même.

### Une suggestion IA peut-elle créer une demande automatiquement ?

Non. Les suggestions d'actions deviennent des demandes uniquement après clic humain.

### Le matching révèle-t-il l'identité des autres dossiers ?

Non. Les correspondances sont pseudonymisées et explicables. Aucune identité n'est révélée automatiquement.

### Le matching est-il activé par défaut ?

Non. Le matching est opt-in. Il doit être activé explicitement pour un dossier.

### Goodissima affiche-t-il un score de compatibilité ?

Non. L'interface privilégie les explications : éléments compatibles, signaux relationnels, clarifications et warnings.

### Les documents sont-ils publics ?

Non. Les documents sont associés au dossier sécurisé et ouverts via des liens signés.

### Le candidat peut-il revenir à son espace sécurisé ?

Oui, lorsque son accès candidat est actif. L'accès repose sur un token sécurisé. Le propriétaire peut le révoquer ou le régénérer.

### Les emails candidats sont-ils toujours visibles ?

Non. Le produit prévoit des canaux privés et des préférences de notification. Certains emails peuvent être masqués ou remplacés selon la configuration.

### Le Centre de gouvernance IA certifie-t-il la conformité réglementaire ?

Non. Il donne de la transparence opérationnelle sur les principes, le provider, le modèle, les tests et le journal IA. Toute certification ou validation juridique doit être traitée séparément.

### Pourquoi une suggestion IA peut-elle être incomplète ?

Parce que l'IA travaille avec le contexte disponible. Si le dossier manque d'informations, Goodissima privilégie les clarifications et les limites plutôt qu'une conclusion artificielle.

<a id="31-glossaire-relationnel"></a>

## 31. Glossaire relationnel

| Terme | Définition |
| --- | --- |
| AIEvent | Événement d'audit lié à un usage IA. |
| AI Workspace | Espace d'intelligence relationnelle du propriétaire. |
| Audit | Historique lisible des événements importants. |
| Brouillons IA | Messages préparés par l'IA, à relire et envoyer manuellement. |
| Centre de gouvernance IA | Zone des paramètres qui affiche provider, modèle, principes et journal IA. |
| Conversation sécurisée | Espace d'échange protégé entre propriétaire et candidat. |
| Dossier relationnel | Espace complet d'une relation : messages, documents, demandes, audit et IA. |
| Explainability-first | Principe consistant à afficher les raisons et limites des suggestions. |
| Human-in-the-loop | Supervision humaine obligatoire pour les actions sensibles. |
| Lien sécurisé | URL publique permettant à un candidat d'entrer dans un parcours. |
| Matching gouverné | Analyse de compatibilité explicable, pseudonymisée et opt-in. |
| Matching opt-in | Activation volontaire du matching sur un dossier. |
| Parcours relationnel | Formulaire structuré et versionnable créé dans Relation Studio. |
| Pseudonymisation | Masquage de l'identité dans les correspondances de matching. |
| RelationCase | Nom technique du dossier relationnel sécurisé. |
| RelationEvent | Événement relationnel lié à la vie du dossier. |
| Relation Studio | Atelier de création, édition et publication des parcours. |
| Résumé IA | Synthèse explicable du dossier relationnel. |
| Signaux IA | Points de vigilance contextualisés, sans décision automatique. |
| Signed URL | Lien temporaire ou contrôlé pour ouvrir un document privé. |
| Timeline IA | Analyse chronologique et relationnelle du dossier. |
| Token candidat | Clé d'accès sécurisée permettant au candidat d'ouvrir son espace. |

<a id="32-captures-disponibles-et-captures-attendues"></a>

## 32. Captures disponibles et captures attendues

Captures intégrées dans ce manuel :

- Accueil ;
- Dashboard ;
- Relation Studio ;
- Nouveau parcours ;
- exemples de parcours ;
- espace candidat ;
- conversation sécurisée ;
- AI Workspace : Résumé IA, Timeline IA, Signaux IA, Matching, Brouillons IA ;
- Analytics ;
- Paramètres et Centre de gouvernance IA.

Captures TODO recommandées pour compléter le manuel :

- page de connexion conseiller ;
- page de création de lien ;
- page de lien créé avec URL publique et aperçu candidat ;
- zoom dédié sur le QR code téléchargeable ;
- panneau de demandes relationnelles ;
- panneau documents avec upload et liste de documents ;
- panneau accès candidat avec révocation et régénération ;
- vue candidat de la conversation sécurisée ;
- état vide du dashboard ;
- état vide de l'AI Workspace avant génération.

---

© Goodissima — Documentation interne
