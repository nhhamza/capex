// One-time migration: push existing mock seed data to Firestore if empty.
// Usage: call runSeedMigration() early in app startup (e.g., in App.tsx after auth) for development only.
// Remove or guard behind an env flag for production.
import { collection, getDocs, addDoc } from "firebase/firestore/lite";
import { db as firestore } from "@/firebase/client";
import { seedDatabase } from "@/mocks/seed";
import { db as memoryDb } from "@/mocks/db";

// IMPORT WARNING: seedDatabase populates the in-memory db; we immediately read from it and write to Firestore.
// Ensure this file remains dev-only.

export async function runSeedMigration() {
  // Check if there are already properties in Firestore
  const existing = await getDocs(collection(firestore, "properties"));
  if (!existing.empty) {
    console.info(
      "[seed-migration] Firestore already has properties; skipping migration"
    );
    return;
  }

  // Populate memory DB
  seedDatabase();

  // Write properties
  for (const prop of memoryDb.properties) {
    const { id, ...rest } = prop;
    await addDoc(collection(firestore, "properties"), {
      ...rest,
      migratedFrom: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  // Leases
  for (const lease of memoryDb.leases) {
    const { id, ...rest } = lease;
    await addDoc(collection(firestore, "leases"), {
      ...rest,
      migratedFrom: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  // Recurring Expenses
  for (const exp of memoryDb.recurringExpenses) {
    const { id, ...rest } = exp;
    await addDoc(collection(firestore, "recurringExpenses"), {
      ...rest,
      migratedFrom: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  // One-off Expenses
  for (const cap of memoryDb.oneOffExpenses) {
    const { id, ...rest } = cap;
    await addDoc(collection(firestore, "oneOffExpenses"), {
      ...rest,
      migratedFrom: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  // Loans
  for (const loan of memoryDb.loans) {
    const { id, ...rest } = loan;
    await addDoc(collection(firestore, "loans"), {
      ...rest,
      migratedFrom: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  console.info("[seed-migration] Migration completed");
}
