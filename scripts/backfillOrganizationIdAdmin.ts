/* scripts/backfillOrganizationIdAdmin.ts
 *
 * Backfill multi-tenant field `organizationId` across collections.
 *
 * Run:
 *   # Option A (recommended): use GOOGLE_APPLICATION_CREDENTIALS
 *   export GOOGLE_APPLICATION_CREDENTIALS="/ABS/PATH/serviceAccount.json"
 *   npx ts-node scripts/backfillOrganizationIdAdmin.ts --projectId YOUR_PROJECT_ID --apply
 *
 *   # Dry run:
 *   npx ts-node scripts/backfillOrganizationIdAdmin.ts --projectId YOUR_PROJECT_ID
 *
 * Notes:
 * - Reads all properties to build propertyId -> organizationId map.
 * - For child collections, sets organizationId based on propertyId.
 * - For users, copies orgId -> organizationId if missing.
 */

import admin from "firebase-admin";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type AnyDoc = FirebaseFirestore.DocumentData;

const argv = yargs(hideBin(process.argv))
  .option("projectId", { type: "string", demandOption: true })
  .option("apply", {
    type: "boolean",
    default: false,
    describe: "If false, runs as dry-run (no writes).",
  })
  .option("limit", {
    type: "number",
    default: 0,
    describe: "Optional limit per collection (0 = no limit).",
  })
  .strict()
  .parseSync();

const PROJECT_ID = argv.projectId;
const APPLY = argv.apply;
const LIMIT = argv.limit;

function init() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = () => admin.firestore();

const COLLECTIONS_CHILD_BY_PROPERTY_ID = [
  "leases",
  "loans",
  "oneOffExpenses",
  "recurringExpenses",
  "rooms",
  "propertyDocs",
  "dealScenarios",
  // añade aquí cualquiera que tenga propertyId
];

async function buildPropertyOrgMap() {
  const map = new Map<string, string>();
  const snap = await db().collection("properties").get();
  let missing = 0;

  snap.docs.forEach((d) => {
    const data = d.data() as AnyDoc;
    const orgId = data.organizationId;
    if (typeof orgId === "string" && orgId.trim()) {
      map.set(d.id, orgId);
    } else {
      missing++;
    }
  });

  console.log(
    `[properties] Loaded ${snap.size}. With organizationId: ${map.size}. Missing: ${missing}.`
  );
  return map;
}

async function backfillUsers() {
  const col = "users";
  const snap = await db().collection(col).get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  const writer = db().bulkWriter();

  for (const d of snap.docs) {
    scanned++;
    const data = d.data() as AnyDoc;

    const hasOrganizationId =
      typeof data.organizationId === "string" && data.organizationId.trim();
    const orgId = data.orgId;

    if (hasOrganizationId) {
      skipped++;
      continue;
    }
    if (!(typeof orgId === "string" && orgId.trim())) {
      // user sin orgId -> lo dejamos para revisión manual
      console.warn(`[users] Doc ${d.id} missing orgId; cannot backfill.`);
      skipped++;
      continue;
    }

    updated++;
    if (APPLY) {
      writer.update(d.ref, { organizationId: orgId });
    }
  }

  if (APPLY) await writer.close();

  console.log(
    `[users] Scanned=${scanned}, Updated=${updated}, Skipped=${skipped}, APPLY=${APPLY}`
  );
}

async function backfillPropertiesMissingOrgId(defaultOrgId?: string) {
  // Si tienes properties sin organizationId, NO hay forma mágica de inferirlo
  // salvo que exista otro campo (createdBy, userId, etc.). Aquí soportamos
  // un "defaultOrgId" opcional por si es un proyecto mono-org.
  const col = "properties";
  const snap = await db().collection(col).get();

  const writer = db().bulkWriter();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    scanned++;
    const data = d.data() as AnyDoc;

    const hasOrganizationId =
      typeof data.organizationId === "string" && data.organizationId.trim();
    if (hasOrganizationId) {
      skipped++;
      continue;
    }

    if (!defaultOrgId) {
      console.warn(
        `[properties] Doc ${d.id} missing organizationId. Provide a default orgId if this is single-tenant, or backfill via createdBy/user mapping.`
      );
      skipped++;
      continue;
    }

    updated++;
    if (APPLY) {
      writer.update(d.ref, { organizationId: defaultOrgId });
    }
  }

  if (APPLY) await writer.close();

  console.log(
    `[properties] Scanned=${scanned}, Updated=${updated}, Skipped=${skipped}, APPLY=${APPLY}`
  );
}

async function backfillChildren(propertyOrgMap: Map<string, string>) {
  for (const col of COLLECTIONS_CHILD_BY_PROPERTY_ID) {
    const ref = db().collection(col);
    const snap = await ref.get();

    const writer = db().bulkWriter();

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let unknownProperty = 0;

    for (const d of snap.docs) {
      scanned++;
      if (LIMIT > 0 && scanned > LIMIT) break;

      const data = d.data() as AnyDoc;

      const hasOrganizationId =
        typeof data.organizationId === "string" && data.organizationId.trim();
      if (hasOrganizationId) {
        skipped++;
        continue;
      }

      const propertyId = data.propertyId;
      if (!(typeof propertyId === "string" && propertyId.trim())) {
        console.warn(`[${col}] Doc ${d.id} missing propertyId; skipping`);
        skipped++;
        continue;
      }

      const orgId = propertyOrgMap.get(propertyId);
      if (!orgId) {
        unknownProperty++;
        console.warn(
          `[${col}] Doc ${d.id} references propertyId=${propertyId} not found or property missing organizationId`
        );
        skipped++;
        continue;
      }

      updated++;
      if (APPLY) {
        writer.update(d.ref, { organizationId: orgId });
      }
    }

    if (APPLY) await writer.close();

    console.log(
      `[${col}] Scanned=${scanned}, Updated=${updated}, Skipped=${skipped}, UnknownProperty=${unknownProperty}, APPLY=${APPLY}`
    );
  }
}

async function main() {
  init();

  console.log(`\n=== Backfill organizationId (ADMIN) ===`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Mode: ${APPLY ? "APPLY (writes enabled)" : "DRY-RUN"}`);
  if (LIMIT) console.log(`Limit per collection: ${LIMIT}`);

  // 1) Users orgId -> organizationId
  await backfillUsers();

  // 2) Properties: si te falta organizationId y esto es mono-org,
  // puedes pasar un default. Si no, lo dejamos reportado.
  // Ejemplo: await backfillPropertiesMissingOrgId("pkkkmLoAPMdFu12grlBo");
  await backfillPropertiesMissingOrgId(undefined);

  // 3) property map
  const propertyOrgMap = await buildPropertyOrgMap();

  // 4) children
  await backfillChildren(propertyOrgMap);

  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
