/**
 * Script to update organization billing plan
 * Usage: node scripts/updateOrgPlan.js <orgId> <plan>
 * Example: node scripts/updateOrgPlan.js r7pLzhs9vBz6wmxIz6V0 pro
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

// Plan limits configuration
const PLAN_LIMITS = {
  free: { propertyLimit: 1, seatLimit: 1 },
  solo: { propertyLimit: 10, seatLimit: 1 },
  pro: { propertyLimit: 50, seatLimit: 3 },
  agency: { propertyLimit: 200, seatLimit: 10 },
};

async function updateOrgPlan(orgId, plan) {
  console.log(`\n🔍 Searching for organization: ${orgId}`);

  // 1. Verify organization exists
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();

  if (!orgSnap.exists) {
    console.error(`❌ Organization ${orgId} not found`);
    return;
  }

  console.log(`✅ Organization found: ${orgSnap.data().name || 'No name'}`);

  // 2. Find users in this organization
  const usersSnap = await db.collection('users')
    .where('organizationId', '==', orgId)
    .get();

  const usersWithOrgId = await db.collection('users')
    .where('orgId', '==', orgId)
    .get();

  const allUsers = new Map();
  usersSnap.docs.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));
  usersWithOrgId.docs.forEach(doc => allUsers.set(doc.id, { id: doc.id, ...doc.data() }));

  console.log(`\n👥 Found ${allUsers.size} user(s) in this organization:`);
  allUsers.forEach((user) => {
    console.log(`   - ${user.email || 'No email'} (${user.id})`);
    console.log(`     Role: ${user.role || 'none'}`);
  });

  // 3. Validate plan
  if (!PLAN_LIMITS[plan]) {
    console.error(`\n❌ Invalid plan: ${plan}`);
    console.log(`Valid plans: ${Object.keys(PLAN_LIMITS).join(', ')}`);
    return;
  }

  const limits = PLAN_LIMITS[plan];
  console.log(`\n📋 Plan "${plan}" limits:`);
  console.log(`   - Properties: ${limits.propertyLimit}`);
  console.log(`   - Seats: ${limits.seatLimit}`);

  // 4. Get current billing info
  const billingRef = db.doc(`organizations/${orgId}/private/billing`);
  const billingSnap = await billingRef.get();
  const currentBilling = billingSnap.data() || {};

  console.log(`\n📊 Current billing status:`);
  console.log(`   - Plan: ${currentBilling.plan || 'free'}`);
  console.log(`   - Status: ${currentBilling.status || 'active'}`);
  console.log(`   - Property Limit: ${currentBilling.propertyLimit || 1}`);
  console.log(`   - Seat Limit: ${currentBilling.seatLimit || 1}`);

  // 5. Update billing
  console.log(`\n🔄 Updating billing to plan "${plan}"...`);

  await billingRef.set({
    ...currentBilling,
    plan,
    status: 'active',
    propertyLimit: limits.propertyLimit,
    seatLimit: limits.seatLimit,
    updatedAt: new Date().toISOString(),
    updatedBy: 'manual-script',
    updatedReason: 'Manual upgrade via script',
  }, { merge: true });

  console.log(`✅ Billing updated successfully!`);

  // 6. Verify update
  const updatedBillingSnap = await billingRef.get();
  const updatedBilling = updatedBillingSnap.data();

  console.log(`\n✅ NEW billing status:`);
  console.log(`   - Plan: ${updatedBilling.plan}`);
  console.log(`   - Status: ${updatedBilling.status}`);
  console.log(`   - Property Limit: ${updatedBilling.propertyLimit}`);
  console.log(`   - Seat Limit: ${updatedBilling.seatLimit}`);

  console.log(`\n🎉 Done! Organization ${orgId} is now on "${plan}" plan.`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
📝 Usage: node scripts/updateOrgPlan.js <orgId> <plan>

Available plans:
  - free   (1 property, 1 seat)
  - solo   (10 properties, 1 seat)
  - pro    (50 properties, 3 seats)
  - agency (200 properties, 10 seats)

Example:
  node scripts/updateOrgPlan.js r7pLzhs9vBz6wmxIz6V0 pro
`);
  process.exit(1);
}

const [orgId, plan] = args;

updateOrgPlan(orgId, plan.toLowerCase())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
