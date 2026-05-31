# Goodissima Trust Architecture

## 1. Vision produit

Goodissima doit evoluer d'une plateforme de relation securisee vers une infrastructure de maitrise des relations.

L'objectif n'est pas seulement de collecter des demandes, centraliser des messages ou suggerer des correspondances. L'objectif est de permettre a une organisation de gouverner la confiance entre des personnes, des entreprises, des partenaires, des tiers de confiance et des contextes relationnels sensibles.

Goodissima devient ainsi une couche d'orchestration relationnelle fondee sur cinq briques :

- des `Trust Policies`, qui definissent les regles de confiance applicables a une relation ;
- des `Trusted Organizations`, qui representent les organisations habilitees a emettre, verifier ou exploiter des signaux de confiance ;
- des `Trust Credentials`, qui portent des attestations, preuves ou validations contextualisees ;
- des mecanismes de `Match Merge`, qui rapprochent deux relations compatibles sous controle humain ;
- des mecanismes de `Trust Merge`, qui consolident plusieurs preuves ou attestations sans perdre leur provenance.

La promesse produit est simple : Goodissima aide a savoir qui peut entrer en relation avec qui, selon quelles preuves, avec quel niveau de confiance, sous quelle politique, et avec quelle tracabilite.

## 2. Relation comme objet central

La relation est l'objet central de Goodissima.

Une relation n'est pas seulement une conversation. Elle est un contexte vivant qui peut contenir :

- une intention ;
- une identite declaree ;
- des messages ;
- des documents ;
- des formulaires ;
- des actions ;
- des decisions humaines ;
- des signaux IA ;
- des correspondances potentielles ;
- des attestations externes ;
- une politique de confiance ;
- un historique d'audit.

Dans l'architecture actuelle, cet objet est principalement porte par `RelationCase`. A terme, `RelationCase` doit rester le noyau operationnel, mais il pourra etre enrichi par des objets de confiance qui ne se confondent pas avec le dossier lui-meme.

Principe directeur :

- une relation reste contextualisee ;
- une preuve reste sourcée ;
- une identite reste gouvernee ;
- une mise en relation reste controlee par un humain ;
- une consolidation ne doit jamais effacer l'origine des informations.

## 3. Trust Policies

Une `Trust Policy` definit les regles selon lesquelles une relation peut etre evaluee, partagee, rapprochee ou consolidee.

Elle peut decrire :

- les donnees minimales requises ;
- les preuves necessaires ;
- les tiers autorises a attester ;
- les criteres de compatibilite ;
- les regles de confidentialite ;
- les conditions de revelation d'identite ;
- les droits d'acces ;
- les durees de conservation ;
- les obligations d'audit ;
- les validations humaines obligatoires.

Exemples de policies :

- `INVESTOR_INTRO_POLICY` : une introduction investisseur/startup exige un consentement explicite, une pseudonymisation initiale et une validation humaine avant revelation d'identite.
- `REAL_ESTATE_RENTAL_POLICY` : un dossier locataire peut exiger des documents, une verification de revenus et une politique de non-discrimination.
- `BANK_RELATION_POLICY` : une relation bancaire peut exiger une gouvernance stricte des preuves, des logs exportables et un cloud souverain.
- `TRUSTED_ATTESTATION_POLICY` : une attestation externe n'est exploitable que si l'organisation emettrice est habilitee.

Une policy ne doit pas etre seulement un texte documentaire. A terme, elle doit devenir un objet executable partiellement par le systeme : controles, warnings, obligations d'audit, permissions et contraintes UI.

## 4. Trusted Organizations

Une `Trusted Organization` est une organisation reconnue par Goodissima ou par un tenant Goodissima comme source, verifier ou consommateur legitime de signaux de confiance.

Elle peut etre :

- une banque ;
- un investisseur ;
- un fonds ;
- une agence immobiliere ;
- un cabinet de conseil ;
- une plateforme partenaire ;
- une autorite de verification ;
- un organisme certificateur ;
- un administrateur de cloud souverain.

Attributs futurs possibles :

- identite legale ;
- domaine email verifie ;
- roles de confiance ;
- niveau d'habilitation ;
- policies applicables ;
- clefs de signature ;
- endpoints d'integration ;
- conditions de retention ;
- journal d'audit dedie.

Une Trusted Organization ne doit pas avoir une confiance globale par defaut. Sa confiance doit etre contextualisee :

- confiance pour emettre une attestation ;
- confiance pour verifier une preuve ;
- confiance pour recevoir une introduction ;
- confiance pour operer une instance souveraine ;
- confiance pour acceder a certaines donnees.

## 5. Trust Credentials

Un `Trust Credential` est une preuve ou attestation contextualisee rattachee a une relation, une personne, une organisation ou une introduction.

Il ne remplace pas les documents existants. Il ajoute une couche de qualification :

- qui affirme quelque chose ;
- sur quel sujet ;
- dans quel contexte ;
- avec quelle date ;
- selon quelle policy ;
- avec quel niveau de verification ;
- avec quelle duree de validite ;
- avec quelle possibilite de revocation.

Exemples :

- attestation d'interet investisseur ;
- verification d'identite ;
- confirmation de capacite financiere ;
- reference professionnelle ;
- attestation de conformité ;
- validation d'un document ;
- preuve de consentement ;
- statut de due diligence ;
- preuve de non-revelation automatique d'identite.

Un Trust Credential doit toujours conserver :

- son emetteur ;
- son destinataire ou sujet ;
- son perimetre ;
- son statut ;
- sa date d'emission ;
- son historique ;
- son lien avec les relations concernees ;
- sa source technique ou documentaire.

Principe majeur : un credential peut etre consolide, mais il ne doit jamais etre ecrase.

## 6. Trust Introduction

Une `Trust Introduction` est une mise en relation gouvernee entre deux parties ou deux relations.

Elle se distingue d'un simple message ou d'une suggestion de matching.

Elle peut passer par plusieurs etapes :

1. detection d'une compatibilite ;
2. affichage pseudonymise ;
3. validation par le proprietaire ;
4. verification des policies applicables ;
5. demande de consentement si necessaire ;
6. revelation progressive d'identite ;
7. creation d'un espace relationnel commun ou d'un lien d'introduction ;
8. audit complet.

La Trust Introduction permet a Goodissima d'eviter deux extremes :

- marketplace ouverte, avec contact trop rapide et perte de controle ;
- coffre documentaire ferme, sans capacite relationnelle.

Elle est le point de passage entre matching, consentement, confiance et action humaine.

## 7. Match Merge

Le `Match Merge` est la consolidation gouvernee de deux relations compatibles.

Il ne s'agit pas de fusionner brutalement deux dossiers. Il s'agit de creer un lien relationnel explicite entre une relation source et une relation cible.

Exemples :

- acheteur et vendeur ;
- investisseur et startup ;
- candidat et recruteur ;
- locataire et proprietaire ;
- banque et client ;
- partenaire commercial et porteur de projet.

Un Match Merge devrait conserver :

- le dossier source ;
- le dossier cible ;
- les identites initialement pseudonymisees ;
- la raison du rapprochement ;
- les signaux compatibles ;
- les warnings ;
- les validations humaines ;
- les consentements ;
- la policy appliquee ;
- les evenements d'audit.

Il peut produire :

- une introduction ;
- une action relationnelle ;
- un espace commun ;
- un nouveau dossier compose ;
- une relation de type `MATCHED`, sans fusion physique des historiques.

Invariant critique : un Match Merge ne doit pas reveler automatiquement l'identite, envoyer automatiquement un message ou supprimer un dossier.

## 8. Trust Merge

Le `Trust Merge` est la consolidation de plusieurs signaux de confiance autour d'une relation ou d'une entite.

Il ne cherche pas a fusionner des personnes. Il cherche a construire une vue gouvernee de preuves multiples.

Exemples :

- une startup fournit un deck, un investisseur ajoute une attestation d'interet, un tiers confirme une due diligence ;
- un candidat fournit un document, une organisation le valide, une autre ajoute une reference ;
- une relation bancaire agrege des preuves issues de plusieurs tiers autorises ;
- un dossier de partenariat consolide attestations, consentements et validations internes.

Le Trust Merge doit conserver :

- chaque credential source ;
- l'emetteur de chaque credential ;
- la date et le statut ;
- les conflits eventuels ;
- les credentials expires ou revoques ;
- le niveau de confiance calcule ou qualifie ;
- la policy utilisee pour produire la synthese.

Le resultat d'un Trust Merge peut etre :

- une synthese de confiance ;
- un statut de verification ;
- une recommandation ;
- un warning ;
- une decision humaine documentee ;
- une preuve composite exportable.

Invariant critique : le Trust Merge ne doit pas ecraser les preuves sources ni masquer les contradictions.

## 9. Architecture SaaS central / cloud souverain

Goodissima peut suivre une architecture hybride :

- un SaaS central pour le produit standard, le studio relationnel, le matching gouverne et les workflows generiques ;
- des deploiements cloud souverain pour les organisations qui exigent controle, localisation, audit, isolation ou exigences reglementaires fortes.

### SaaS central

Le SaaS central est adapte pour :

- PME ;
- agences ;
- investisseurs independants ;
- premiers parcours relationnels ;
- prototypes de policies ;
- matching gouverne standard ;
- experimentation produit.

Il privilegie :

- rapidite ;
- mutualisation ;
- iteration ;
- cout reduit ;
- experience produit unifiee.

### Cloud souverain

Le cloud souverain est adapte pour :

- banques ;
- assureurs ;
- institutions ;
- grands comptes ;
- organisations regulées ;
- consortiums de confiance ;
- donnees sensibles ou localisees.

Il peut imposer :

- instance dediee ;
- base dediee ;
- chiffrement renforce ;
- clefs controlees par le client ;
- logs exportables ;
- retention configurable ;
- isolation reseau ;
- fournisseurs IA controles ;
- absence de transfert hors perimetre ;
- policies non modifiables sans validation.

### Principe de portabilite

Les concepts de confiance doivent etre les memes dans les deux modes :

- `RelationCase` ;
- Trust Policy ;
- Trusted Organization ;
- Trust Credential ;
- Match Merge ;
- Trust Merge ;
- Audit.

La difference doit porter sur l'operation, la gouvernance, la residence des donnees et les integrations, pas sur le langage metier.

## 10. Choix a faire

Plusieurs choix structurants devront etre tranches avant implementation.

### Modele de donnees

- Faut-il introduire un modele `Organization` distinct de `User` ?
- Faut-il introduire un modele `Participant` ?
- Un Trust Credential est-il rattache a une relation, a une organisation, a une personne ou aux trois ?
- Un Match Merge cree-t-il un nouvel objet ou seulement une relation entre deux dossiers ?
- Un Trust Merge produit-il un credential composite ?

### Gouvernance

- Qui peut creer une Trust Policy ?
- Qui peut modifier une policy deja utilisee ?
- Faut-il versionner les policies ?
- Faut-il rendre certaines policies immuables ?
- Comment gerer les conflits entre policies ?

### Confidentialite

- Quand l'identite peut-elle etre revelee ?
- Qui consent a quoi ?
- Comment prouver le consentement ?
- Quelles donnees restent pseudonymisees ?
- Quelles donnees sont visibles par une organisation tierce ?

### Audit

- Quel niveau d'audit est requis pour chaque domaine ?
- Faut-il un export d'audit signe ?
- Faut-il des logs append-only ?
- Faut-il des preuves horodatees externes ?

### IA et matching

- Quels signaux peuvent alimenter le matching ?
- Quels signaux sont interdits ?
- Les embeddings doivent-ils etre par tenant, par policy ou par domaine ?
- Comment purger ou regenerer les embeddings apres revocation ?

### Produit

- Le MVP doit-il viser l'investissement, l'immobilier, la banque ou le recrutement ?
- La premiere valeur doit-elle etre Match Merge ou Trust Merge ?
- Faut-il exposer les concepts de confiance dans l'UI des le debut, ou les garder en back-office ?

## 11. Roadmap de realisation MVP

### Phase 1 : cadrage fondateur

- formaliser les concepts ;
- choisir le premier domaine d'usage ;
- definir les invariants de gouvernance ;
- documenter les policies minimales ;
- aligner le vocabulaire produit et technique.

### Phase 2 : Trust Policy minimale

- ajouter une notion de policy rattachee a un parcours ou dossier ;
- stocker une version de policy ;
- afficher les contraintes principales ;
- journaliser les changements critiques ;
- conserver la compatibilite avec les parcours existants.

### Phase 3 : Match Merge MVP

- creer un objet de proposition de match entre deux relations ;
- conserver source, cible, raisons, warnings et statut ;
- exiger validation humaine ;
- interdire revelation automatique d'identite ;
- journaliser la proposition et son acceptation ou rejet ;
- afficher une timeline claire.

### Phase 4 : Trust Credential MVP

- creer un modele minimal d'attestation ;
- rattacher un credential a un dossier ;
- conserver emetteur, sujet, type, statut, date et payload ;
- permettre une validation humaine ;
- afficher les credentials dans le workspace proprietaire.

### Phase 5 : Trust Merge MVP

- consolider plusieurs credentials sans supprimer les sources ;
- produire une synthese lisible ;
- signaler les contradictions ;
- afficher le niveau de verification de maniere non deterministe et explicable ;
- permettre export ou revue humaine.

### Phase 6 : Trusted Organizations

- introduire les organisations ;
- rattacher utilisateurs, policies et credentials ;
- gerer roles et permissions ;
- verifier domaines ou invitations ;
- preparer les integrations partenaires.

### Phase 7 : mode souverain

- isoler tenant et donnees ;
- renforcer audit et retention ;
- documenter les exigences de deploiement ;
- preparer fournisseurs IA configurables ;
- definir les garanties d'exploitation.

## 12. Impacts techniques futurs

### Prisma et donnees

Impacts probables :

- nouveaux modeles `Organization`, `OrganizationMembership`, `TrustPolicy`, `TrustCredential`, `MatchMerge`, `TrustMerge`, `TrustIntroduction` ;
- versioning de policies ;
- statuts explicites ;
- relations source/cible ;
- payloads JSON gouvernes ;
- index par tenant, organisation, relation et statut ;
- audit plus fin.

### API

Routes futures possibles :

- `POST /api/trust-policies` ;
- `POST /api/cases/[caseId]/match-merges` ;
- `POST /api/cases/[caseId]/trust-credentials` ;
- `POST /api/cases/[caseId]/trust-merges` ;
- `POST /api/trust-introductions/[introductionId]/accept` ;
- `POST /api/trust-introductions/[introductionId]/reveal-identity` ;
- `GET /api/organizations/[organizationId]/audit`.

### UI

Evolutions probables :

- panneau Trust dans le Relation Workspace ;
- vue credentials ;
- timeline trust ;
- panneau policies ;
- ecran de proposition d'introduction ;
- comparaison source/cible pour Match Merge ;
- synthese de preuves pour Trust Merge ;
- centre de gouvernance organisation.

### Audit

Evenements futurs possibles :

- `TRUST_POLICY_ASSIGNED` ;
- `TRUST_CREDENTIAL_CREATED` ;
- `TRUST_CREDENTIAL_VERIFIED` ;
- `TRUST_CREDENTIAL_REVOKED` ;
- `MATCH_MERGE_PROPOSED` ;
- `MATCH_MERGE_ACCEPTED` ;
- `MATCH_MERGE_REJECTED` ;
- `TRUST_MERGE_CREATED` ;
- `TRUST_INTRODUCTION_CREATED` ;
- `IDENTITY_REVEALED`.

### IA

L'IA pourra aider a :

- expliquer une policy ;
- resumer des credentials ;
- detecter contradictions et manques ;
- proposer des introductions ;
- preparer une revue humaine ;
- produire des warnings.

Elle ne devra pas :

- valider une preuve seule ;
- reveler une identite seule ;
- accepter un merge seule ;
- produire un score opaque ;
- remplacer une decision humaine.

### Securite et conformite

Impacts attendus :

- permissions par organisation ;
- separation stricte tenant/organisation ;
- gestion du consentement ;
- retention par policy ;
- export d'audit ;
- chiffrement renforce pour credentials sensibles ;
- gouvernance des embeddings ;
- fournisseurs IA configurables ;
- preparation cloud souverain.

## Conclusion

Goodissima Trust Architecture positionne Goodissima comme une infrastructure de relations gouvernees : le produit ne se limite pas a connecter des parties, il orchestre les conditions de confiance, les preuves, les consentements, les introductions et les consolidations sans perdre l'origine des donnees ni retirer l'humain de la decision.
