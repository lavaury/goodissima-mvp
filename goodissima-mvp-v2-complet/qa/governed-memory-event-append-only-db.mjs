import { PrismaClient } from "@prisma/client";

if (process.env.GOODISSIMA_ENV !== "staging" || !process.env.DIRECT_URL?.includes("rapidwfkaohweoovienf")) {
  throw new Error("This rollback-only check is restricted to the expected Staging project.");
}

const prisma = new PrismaClient();
const rollbackMarker = "ROLLBACK_APPEND_ONLY_CHECK";
const before = await prisma.governedMemoryEvent.count();
const catalog = await prisma.$queryRaw`
  SELECT trigger_name::text, action_timing::text,
         array_to_string(array_agg(event_manipulation ORDER BY event_manipulation), ',')::text AS events,
         action_statement::text
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
    AND event_object_table = 'GovernedMemoryEvent'
    AND trigger_name = 'GovernedMemoryEvent_append_only'
  GROUP BY trigger_name, action_timing, action_statement
`;
const triggerInstalled = catalog.length === 1
  && catalog[0].action_timing === "BEFORE"
  && catalog[0].events === "DELETE,UPDATE"
  && catalog[0].action_statement.includes("reject_governed_memory_event_mutation");
let insertAllowed = false;
let selectAllowed = false;
let updateBlocked = false;
let deleteBlocked = false;

try {
  await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw`
      INSERT INTO "GovernedMemoryEvent" (
        "id", "relationCaseId", "type", "actorType", "actorUserId", "actorRepresentationId",
        "objectType", "objectId", "occurredAt", "recordedAt", "summary", "createdAt",
        "relationTemplateId", "governedJourneyId"
      )
      SELECT
        ${`append-only-check-${Date.now()}`}, "relationCaseId", "type", "actorType", "actorUserId", "actorRepresentationId",
        "objectType", "objectId", "occurredAt", now(), 'Append-only guard rollback check', now(),
        "relationTemplateId", "governedJourneyId"
      FROM "GovernedMemoryEvent"
      ORDER BY "recordedAt"
      LIMIT 1
      RETURNING "id"
    `;
    if (!Array.isArray(inserted) || inserted.length !== 1) throw new Error("No source event available for rollback fixture");
    const fixtureId = inserted[0].id;
    insertAllowed = true;
    selectAllowed = (await tx.governedMemoryEvent.count({ where: { id: fixtureId } })) === 1;

    await tx.$executeRawUnsafe(`
      CREATE FUNCTION pg_temp.append_only_update_blocked(target_id text)
      RETURNS boolean LANGUAGE plpgsql AS $function$
      BEGIN
        BEGIN
          UPDATE "GovernedMemoryEvent" SET "summary" = "summary" WHERE "id" = target_id;
          RETURN false;
        EXCEPTION WHEN OTHERS THEN
          RETURN SQLERRM = 'GovernedMemoryEvent is append-only';
        END;
      END;
      $function$;
    `);
    await tx.$executeRawUnsafe(`
      CREATE FUNCTION pg_temp.append_only_delete_blocked(target_id text)
      RETURNS boolean LANGUAGE plpgsql AS $function$
      BEGIN
        BEGIN
          DELETE FROM "GovernedMemoryEvent" WHERE "id" = target_id;
          RETURN false;
        EXCEPTION WHEN OTHERS THEN
          RETURN SQLERRM = 'GovernedMemoryEvent is append-only';
        END;
      END;
      $function$;
    `);

    const result = await tx.$queryRawUnsafe(`
      SELECT
        (SELECT pg_temp.append_only_update_blocked($1)) AS update_blocked,
        (SELECT pg_temp.append_only_delete_blocked($1)) AS delete_blocked
    `, fixtureId);
    updateBlocked = result[0]?.update_blocked === true;
    deleteBlocked = result[0]?.delete_blocked === true;
    throw new Error(rollbackMarker);
  });
} catch (error) {
  if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
} finally {
  await prisma.$disconnect();
}

const verifier = new PrismaClient();
try {
  const after = await verifier.governedMemoryEvent.count();
  console.log(JSON.stringify({ triggerInstalled, insertAllowed, selectAllowed, updateBlocked, deleteBlocked, before, after, historicalEventsIntact: before === after }));
  if (!triggerInstalled || !insertAllowed || !selectAllowed || !updateBlocked || !deleteBlocked || before !== after) process.exitCode = 1;
} finally {
  await verifier.$disconnect();
}
