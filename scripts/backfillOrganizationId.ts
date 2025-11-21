/**
 * One-off migration script to backfill missing organizationId on existing documents.
 *
 * Usage (PowerShell):
 *   Set-Item -Path Env:FIREBASE_API_KEY "your-api-key"
 *   Set-Item -Path Env:FIREBASE_AUTH_DOMAIN "your-auth-domain"
 *   Set-Item -Path Env:FIREBASE_PROJECT_ID "your-project-id"
 *   npx ts-node scripts/backfillOrganizationId.ts --org YOUR_ORG_ID --collection properties
 *
 * IMPORTANT: Security rules as written require organizationId to already be present
 * on resource.data for update. If your rules block these writes, temporarily relax
 * the update rule to allow adding organizationId where missing, e.g.:
 *   allow update: if isAuthed() && ((resource.data.organizationId == null && sameOrg(request.resource.data)) || sameOrg(resource.data));
 * Deploy the relaxed rule, run this script, then revert.
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore/lite";

const ORG_ID_ARG_INDEX = process.argv.indexOf("--org");
const COLLECTION_ARG_INDEX = process.argv.indexOf("--collection");
if (ORG_ID_ARG_INDEX === -1 || COLLECTION_ARG_INDEX === -1) {
  console.error(
    "Missing required args. Example: ts-node scripts/backfillOrganizationId.ts --org abc123 --collection properties"
  );
  process.exit(1);
}
const TARGET_ORG_ID = process.argv[ORG_ID_ARG_INDEX + 1];
const TARGET_COLLECTION = process.argv[COLLECTION_ARG_INDEX + 1];

if (!TARGET_ORG_ID) {
  console.error("Org ID argument empty");
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function run() {
  console.log(
    `[backfill] Scanning collection "${TARGET_COLLECTION}" for missing organizationId ...`
  );
  const snap = await getDocs(collection(db, TARGET_COLLECTION));
  let total = 0;
  let updated = 0;
  for (const d of snap.docs) {
    total++;
    const data = d.data();
    if (!("organizationId" in data) || !data.organizationId) {
      try {
        await updateDoc(doc(db, TARGET_COLLECTION, d.id), {
          organizationId: TARGET_ORG_ID,
        });
        updated++;
        console.log(`[backfill] Updated doc ${d.id}`);
      } catch (err) {
        console.error(`[backfill] Failed to update doc ${d.id}:`, err);
      }
    }
  }
  console.log(
    `[backfill] Completed. Total scanned: ${total}. Updated: ${updated}.`
  );
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
