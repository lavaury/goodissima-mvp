# Audit des transitions GovernedMemory — 02A.2b

## Supportées maintenant

Les créations `PROPOSE_FACT`, `RECORD_DECISION` et `REGISTER_SOURCE` utilisent `GovernedMemoryCreationRequest`. Les transitions `ESTABLISH_FACT`, `DISPUTE_FACT` et `VALIDATE_DECISION` utilisent `GovernedMemoryTransitionRequest`. Chaque opération exige un Journey et un dossier liés, une capacité mémoire effective, une transaction atomique, une clé idempotente et un nouvel événement append-only.

Les qualifications finales exigent un acteur humain et un rôle mémoire actif permettant de renseigner la provenance de validation. Le runtime n'expose aucune entrée `SYSTEM`. Une source reste distincte d'un fait ou d'une décision.

## MODEL_GAP

`resolveDispute`, `maintainDispute`, `withdrawDispute`, `reviseFact`, `replaceDecision`, `cancelDecision` et `attachSource` ne sont pas exposées. Le stockage possède certains statuts ou types de relations correspondants, mais aucune combinaison complète et non ambiguë de permission, `GovernedMemoryTransitionType`, forme de requête idempotente et événement final n'est définie.

Ces opérations nécessitent un arbitrage 02A.2c. `WITHDRAWN` reste exclusivement un statut de contestation et ne s'applique ni à un fait `PROPOSED`, ni à une décision `DRAFT`.
