import { getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { getStorage } from "firebase-admin/storage";

// Get Firestore instance
const getDb = () => getFirestore();

/**
 * Export all Firestore collections to JSON
 * This is a callable function that requires authentication
 * Only users with admin/owner role can export data
 */
export async function exportFirestoreData(
  data: { organizationId?: string },
  context: functions.https.CallableContext
) {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to export data"
    );
  }

  const uid = context.auth.uid;

  // Check if user has permission (owner role)
  const userDoc = await getDb().collection("users").doc(uid).get();
  const userData = userDoc.data();

  if (!userData || userData.role !== "owner") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only organization owners can export data"
    );
  }

  try {
    const { organizationId } = data;
    const exportData: Record<string, any[]> = {};

    // If organizationId is provided, filter by organization
    // Otherwise export all accessible data for the user
    const orgId = organizationId || userData.orgId;

    if (!orgId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No organization ID found"
      );
    }

    // List of collections to export with organization filtering
    const collectionsToExport = [
      "properties",
      "leases",
      "recurringExpenses",
      "oneOffExpenses",
      "loans",
      "propertyDocs",
    ];

    // Export organization-specific collections
    for (const collectionName of collectionsToExport) {
      const snapshot = await getDb()
        .collection(collectionName)
        .where("propertyId", ">=", "")
        .get();

      exportData[collectionName] = [];

      // Filter by organization (assuming properties belong to the org)
      const properties = await getDb()
        .collection("properties")
        .where("organizationId", "==", orgId)
        .get();

      const propertyIds = properties.docs.map((doc) => doc.id);

      snapshot.forEach((doc) => {
        const docData = doc.data();
        // Include document if it belongs to one of the organization's properties
        if (
          collectionName === "properties" ||
          (docData.propertyId && propertyIds.includes(docData.propertyId))
        ) {
          exportData[collectionName].push({
            id: doc.id,
            ...docData,
          });
        }
      });

      console.log(
        `Exported collection: ${collectionName} (${exportData[collectionName].length} docs)`
      );
    }

    // Export organization data
    const orgDoc = await getDb().collection("organizations").doc(orgId).get();
    if (orgDoc.exists) {
      exportData["organization"] = [
        {
          id: orgDoc.id,
          ...orgDoc.data(),
        },
      ];
    }

    // Export user data (only the requesting user)
    exportData["users"] = [
      {
        id: uid,
        ...userData,
      },
    ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `firestore-export-${orgId}-${timestamp}.json`;

    // Option 1: Return data directly (for small datasets)
    // return { data: exportData, filename };

    // Option 2: Save to Cloud Storage and return download URL (for large datasets)
    const bucket = getStorage().bucket();
    const file = bucket.file(`exports/${filename}`);

    await file.save(JSON.stringify(exportData, null, 2), {
      contentType: "application/json",
      metadata: {
        metadata: {
          exportedBy: uid,
          exportedAt: timestamp,
          organizationId: orgId,
        },
      },
    });

    // Generate a signed URL valid for 1 hour
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    console.log(`Export completed: ${filename}`);

    return {
      success: true,
      filename,
      downloadUrl: url,
      message: "Export completed successfully",
    };
  } catch (error: any) {
    console.error("Export error:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to export data: ${error.message}`
    );
  }
}

/**
 * Scheduled function to create automatic backups
 * Runs daily at 2 AM UTC
 */
export async function scheduledBackup() {
  try {
    console.log("Starting scheduled backup...");

    const exportData: Record<string, any[]> = {};

    // Get all collections
    const collections = await getDb().listCollections();

    for (const col of collections) {
      const colName = col.id;
      const snapshot = await col.get();

      exportData[colName] = [];

      snapshot.forEach((doc) => {
        exportData[colName].push({
          id: doc.id,
          ...doc.data(),
        });
      });

      console.log(
        `Backed up collection: ${colName} (${exportData[colName].length} docs)`
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `scheduled-backup-${timestamp}.json`;

    // Save to Cloud Storage
    const bucket = getStorage().bucket();
    const file = bucket.file(`backups/${filename}`);

    await file.save(JSON.stringify(exportData, null, 2), {
      contentType: "application/json",
      metadata: {
        metadata: {
          backupType: "scheduled",
          backupDate: timestamp,
        },
      },
    });

    console.log(`Scheduled backup completed: ${filename}`);

    return { success: true, filename };
  } catch (error: any) {
    console.error("Scheduled backup error:", error);
    throw error;
  }
}
