// Run this script with: node scripts/make-owner.js <user-email>
// Requires firebase-admin installed: npm install firebase-admin --save-dev

const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need your service account key)
// Download from Firebase Console > Project Settings > Service Accounts
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function makeUserOwner(email) {
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error(`User with email ${email} not found`);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    
    // Update role to owner
    await userDoc.ref.update({
      role: 'owner'
    });

    console.log(`✅ Successfully updated ${email} to owner role`);
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    process.exit();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-owner.js <user-email>');
  process.exit(1);
}

makeUserOwner(email);
