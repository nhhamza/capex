/**
 * Script to update all FREE plan organizations to new limits (1 property instead of 2)
 * Usage: node scripts/updateFreePlanLimits.js
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

// Initialize Firebase Admin
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('../backend/serviceAccountKey.json');
  }
} catch (error) {
  console.error('❌ Error loading service account:', error.message);
  console.log('\nPlease ensure either:');
  console.log('1. FIREBASE_SERVICE_ACCOUNT env var is set in backend/.env');
  console.log('2. backend/serviceAccountKey.json exists');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
});

const db = admin.firestore();

async function updateFreePlanLimits() {
  console.log('\n🔍 Searching for organizations with FREE plan...\n');

  try {
    // Get all organizations
    const orgsSnap = await db.collection('organizations').get();

    let updatedCount = 0;
    let skippedCount = 0;
    const updates = [];

    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();

      // Get billing info
      const billingRef = db.doc(`organizations/${orgId}/private/billing`);
      const billingSnap = await billingRef.get();

      if (!billingSnap.exists) {
        console.log(`⏭️  Skipping ${orgData.name || orgId} - No billing document`);
        skippedCount++;
        continue;
      }

      const billing = billingSnap.data();

      // Check if it's a FREE plan with old limit (2 properties)
      if (billing.plan === 'free' && billing.propertyLimit === 2) {
        console.log(`📝 Updating ${orgData.name || orgId}`);
        console.log(`   Current: ${billing.propertyLimit} properties`);
        console.log(`   New: 1 property`);

        updates.push({
          orgId,
          name: orgData.name || 'No name',
          billingRef,
          currentLimit: billing.propertyLimit
        });
      } else if (billing.plan === 'free' && billing.propertyLimit === 1) {
        console.log(`✅ Already updated: ${orgData.name || orgId} (1 property)`);
        skippedCount++;
      } else {
        console.log(`⏭️  Skipping ${orgData.name || orgId} - Plan: ${billing.plan}`);
        skippedCount++;
      }
    }

    if (updates.length === 0) {
      console.log('\n✅ No organizations need updating!');
      console.log(`   Total checked: ${orgsSnap.size}`);
      console.log(`   Already up to date or not FREE plan: ${skippedCount}`);
      return;
    }

    console.log(`\n⚠️  Found ${updates.length} organization(s) to update:`);
    updates.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.name} (${u.orgId})`);
    });

    console.log('\n🔄 Updating billing documents...\n');

    // Update all
    for (const update of updates) {
      await update.billingRef.set({
        propertyLimit: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'script-updateFreePlanLimits',
        updatedReason: 'Update FREE plan limit from 2 to 1 property'
      }, { merge: true });

      console.log(`✅ Updated: ${update.name}`);
      updatedCount++;
    }

    console.log(`\n🎉 Done!`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${orgsSnap.size}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Execute
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Update FREE Plan Limits (2 → 1 property)             ║');
console.log('╚════════════════════════════════════════════════════════╝');

updateFreePlanLimits()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
