import admin from "firebase-admin";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = getFirestore();

async function backfillLastSignInTime() {
  console.log("Starting backfill of lastSignInTime...");

  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log(`Found ${users.length} users to process`);

  const chunkSize = 100;
  let updated = 0;

  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const uids = chunk.map((user) => user.id);

    try {
      const authResult = await admin.auth().getUsers({ uids });
      const updates = [];

      for (const authUser of authResult.users) {
        const userDoc = chunk.find((u) => u.id === authUser.uid);
        if (
          userDoc &&
          authUser.metadata?.lastSignInTime &&
          !userDoc.lastSignInTime
        ) {
          updates.push({
            uid: authUser.uid,
            lastSignInTime: authUser.metadata.lastSignInTime,
          });
        }
      }

      // Batch update
      const batch = db.batch();
      for (const update of updates) {
        const userRef = db.collection("users").doc(update.uid);
        batch.set(
          userRef,
          {
            lastSignInTime: update.lastSignInTime,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }

      if (updates.length > 0) {
        await batch.commit();
        updated += updates.length;
        console.log(
          `Updated ${updates.length} users in chunk ${Math.floor(i / chunkSize) + 1}`,
        );
      }
    } catch (err) {
      console.warn(
        `Error processing chunk ${Math.floor(i / chunkSize) + 1}:`,
        err,
      );
    }
  }

  console.log(`Backfill complete. Updated ${updated} users.`);
}

// Run the backfill
backfillLastSignInTime().catch(console.error);
