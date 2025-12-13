import {
  Property,
  Lease,
  RecurringExpense,
  OneOffExpense,
  Loan,
  Room,
} from "./types";
// Firestore migration: using flat collections. Legacy in-memory implementation retained below in comments for reference.
import { db as firestore } from "@/firebase/client";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
} from "firebase/firestore/lite";
import {
  hasInvalidNumbers,
  cleanUndefinedDeep,
} from "../../utils/firestoreGuards";

// Collection references (flat)
const COL_PROPERTIES = "properties";
const COL_LEASES = "leases";
const COL_RECURRING = "recurringExpenses";
const COL_ONEOFF = "oneOffExpenses";
const COL_LOANS = "loans";
const COL_ROOMS = "rooms";
const COL_PROPERTY_DOCS = "propertyDocs";

// ---------- Properties CRUD (Firestore) ----------
export async function getProperties(
  organizationId: string
): Promise<Property[]> {
  // Log only once per session + light throttling to avoid console spam
  const now = Date.now();
  const last = (window as any).__FIRESTORE_LAST_PROP_READ || 0;
  if (!(window as any).__FIRESTORE_TRANSPORT_LOGGED) {
    console.log("[Firestore] Using lite SDK (REST) for /properties queries");
    (window as any).__FIRESTORE_TRANSPORT_LOGGED = true;
  }
  if (now - last > 3000) {
    // 3s throttle window
    console.log("[Firestore] Reading /properties for org", organizationId);
    (window as any).__FIRESTORE_LAST_PROP_READ = now;
  }
  const q = query(
    collection(firestore, COL_PROPERTIES),
    where("organizationId", "==", organizationId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as Omit<Property, "id">;
    const rentalMode = raw.rentalMode ?? "ENTIRE_UNIT";
    return {
      id: d.id,
      ...raw,
      rentalMode,
    };
  });
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const ref = doc(firestore, COL_PROPERTIES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  const raw = snap.data() as Omit<Property, "id">;
  const rentalMode = raw.rentalMode ?? "ENTIRE_UNIT";
  return { id: snap.id, ...raw, rentalMode };
}

export async function createProperty(
  data: Omit<Property, "id">
): Promise<Property> {
  const now = new Date().toISOString();
  let payload = cleanUndefinedDeep({ ...data, createdAt: now, updatedAt: now });
  if (!(payload as any).organizationId) {
    console.error(
      "[createProperty] Missing organizationId in payload. This will cause multi-tenant queries to skip this document and security rules to reject writes once enforced."
    );
    throw new Error("organizationId requerido en createProperty");
  }
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  console.log(
    "[createProperty] (lite) Payload:",
    JSON.stringify(payload, null, 2)
  );
  try {
    const docRef = await addDoc(collection(firestore, COL_PROPERTIES), payload);
    console.log("[createProperty] (lite) Success, doc ID:", docRef.id);
    return { id: docRef.id, ...(payload as Omit<Property, "id">) } as Property;
  } catch (err: any) {
    console.error("[createProperty] (lite) Firestore error:", {
      code: err.code,
      message: err.message,
      name: err.name,
      toString: err.toString?.(),
    });
    throw err;
  }
}

export async function updateProperty(
  id: string,
  data: Partial<Property>
): Promise<Property> {
  const ref = doc(firestore, COL_PROPERTIES, id);
  let payload = cleanUndefinedDeep({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  await updateDoc(ref, payload);
  const updated = await getProperty(id);
  if (!updated) throw new Error("Property not found after update");
  return updated;
}

export async function deleteProperty(id: string): Promise<void> {
  // Delete property document
  const propRef = doc(firestore, COL_PROPERTIES, id);
  await deleteDoc(propRef);
  // Cascade delete related documents (client-side; consider Cloud Functions for atomicity)
  await cascadeDeleteByProperty(id);
}

// ---------- Leases CRUD (Firestore) ----------
export async function getLeases(propertyId: string): Promise<Lease[]> {
  const q = query(
    collection(firestore, COL_LEASES),
    where("propertyId", "==", propertyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Lease, "id">),
  }));
}

export async function getLease(propertyId: string): Promise<Lease | undefined> {
  const leases = await getLeases(propertyId);
  return leases[0]; // Assuming single active lease; improve selection later
}

export async function createLease(data: Omit<Lease, "id">): Promise<Lease> {
  const now = new Date().toISOString();
  let payload = cleanUndefinedDeep({ ...data, createdAt: now, updatedAt: now });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  const docRef = await addDoc(collection(firestore, COL_LEASES), payload);
  return { id: docRef.id, ...(payload as Omit<Lease, "id">) } as Lease;
}

export async function updateLease(
  id: string,
  data: Partial<Lease>
): Promise<Lease> {
  const ref = doc(firestore, COL_LEASES, id);
  let payload = cleanUndefinedDeep({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Lease not found");
  return { id: snap.id, ...(snap.data() as Omit<Lease, "id">) };
}

export async function deleteLease(id: string): Promise<void> {
  const ref = doc(firestore, COL_LEASES, id);
  await deleteDoc(ref);
}

// Recurring Expenses
export async function getRecurringExpenses(
  propertyId: string
): Promise<RecurringExpense[]> {
  const q = query(
    collection(firestore, COL_RECURRING),
    where("propertyId", "==", propertyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<RecurringExpense, "id">),
  }));
}

export async function createRecurringExpense(
  data: Omit<RecurringExpense, "id">
): Promise<RecurringExpense> {
  const now = new Date().toISOString();
  let payload = cleanUndefinedDeep({ ...data, createdAt: now, updatedAt: now });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  const docRef = await addDoc(collection(firestore, COL_RECURRING), payload);
  return {
    id: docRef.id,
    ...(payload as Omit<RecurringExpense, "id">),
  } as RecurringExpense;
}

export async function updateRecurringExpense(
  id: string,
  data: Partial<RecurringExpense>
): Promise<RecurringExpense> {
  const ref = doc(firestore, COL_RECURRING, id);
  let payload = cleanUndefinedDeep({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Expense not found");
  return { id: snap.id, ...(snap.data() as Omit<RecurringExpense, "id">) };
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const ref = doc(firestore, COL_RECURRING, id);
  await deleteDoc(ref);
}

// One-off Expenses (CapEx)
export async function getOneOffExpenses(
  propertyId: string
): Promise<OneOffExpense[]> {
  const q = query(
    collection(firestore, COL_ONEOFF),
    where("propertyId", "==", propertyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<OneOffExpense, "id">),
  }));
}

export async function createOneOffExpense(
  data: Omit<OneOffExpense, "id">
): Promise<OneOffExpense> {
  const now = new Date().toISOString();
  let payload = cleanUndefinedDeep({ ...data, createdAt: now, updatedAt: now });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  const docRef = await addDoc(collection(firestore, COL_ONEOFF), payload);
  return {
    id: docRef.id,
    ...(payload as Omit<OneOffExpense, "id">),
  } as OneOffExpense;
}

export async function updateOneOffExpense(
  id: string,
  data: Partial<OneOffExpense>
): Promise<OneOffExpense> {
  const ref = doc(firestore, COL_ONEOFF, id);
  let payload = cleanUndefinedDeep({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Expense not found");
  return { id: snap.id, ...(snap.data() as Omit<OneOffExpense, "id">) };
}

export async function deleteOneOffExpense(id: string): Promise<void> {
  const ref = doc(firestore, COL_ONEOFF, id);
  await deleteDoc(ref);
}

// Loans
export async function getLoans(propertyId: string): Promise<Loan[]> {
  const q = query(
    collection(firestore, COL_LOANS),
    where("propertyId", "==", propertyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Loan, "id">),
  }));
}

export async function getLoan(propertyId: string): Promise<Loan | undefined> {
  const loans = await getLoans(propertyId);
  return loans[0];
}

export async function createLoan(data: Omit<Loan, "id">): Promise<Loan> {
  const now = new Date().toISOString();
  let payload = cleanUndefinedDeep({ ...data, createdAt: now, updatedAt: now });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  const docRef = await addDoc(collection(firestore, COL_LOANS), payload);
  return { id: docRef.id, ...(payload as Omit<Loan, "id">) } as Loan;
}

export async function updateLoan(
  id: string,
  data: Partial<Loan>
): Promise<Loan> {
  const ref = doc(firestore, COL_LOANS, id);
  let payload = cleanUndefinedDeep({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Loan not found");
  return { id: snap.id, ...(snap.data() as Omit<Loan, "id">) };
}

export async function deleteLoan(id: string): Promise<void> {
  const ref = doc(firestore, COL_LOANS, id);
  await deleteDoc(ref);
}

// ---------- Rooms CRUD (Firestore) ----------
/**
 * Get all rooms for a property
 */
export async function getRooms(propertyId: string): Promise<Room[]> {
  const q = query(
    collection(firestore, COL_ROOMS),
    where("propertyId", "==", propertyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Room, "id">),
  }));
}

/**
 * Get a single room by ID
 */
export async function getRoom(id: string): Promise<Room | undefined> {
  const ref = doc(firestore, COL_ROOMS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  return { id: snap.id, ...(snap.data() as Omit<Room, "id">) };
}

/**
 * Create a new room for a property
 */
export async function createRoom(
  propertyId: string,
  data: Omit<Room, "id" | "propertyId">
): Promise<Room> {
  const now = new Date().toISOString();
  let payload = cleanUndefinedDeep({
    ...data,
    propertyId,
    createdAt: now,
    updatedAt: now,
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  const docRef = await addDoc(collection(firestore, COL_ROOMS), payload);
  return { id: docRef.id, ...(payload as Omit<Room, "id">) } as Room;
}

/**
 * Update a room
 */
export async function updateRoom(
  propertyId: string,
  roomId: string,
  data: Partial<Omit<Room, "id" | "propertyId">>
): Promise<Room> {
  const ref = doc(firestore, COL_ROOMS, roomId);
  let payload = cleanUndefinedDeep({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  if (hasInvalidNumbers(payload))
    throw new Error("Payload contains NaN/Infinity");
  await updateDoc(ref, payload);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room not found");
  const roomData = snap.data() as Omit<Room, "id">;
  // Verify propertyId matches (security check)
  if (roomData.propertyId !== propertyId) {
    throw new Error("Room does not belong to this property");
  }
  return { id: snap.id, ...roomData };
}

/**
 * Delete a room
 */
export async function deleteRoom(
  propertyId: string,
  roomId: string
): Promise<void> {
  // Verify room belongs to property before deleting (security check)
  const room = await getRoom(roomId);
  if (!room) {
    throw new Error("Room not found");
  }
  if (room.propertyId !== propertyId) {
    throw new Error("Room does not belong to this property");
  }
  const ref = doc(firestore, COL_ROOMS, roomId);
  await deleteDoc(ref);
}

// Property documents (simple file metadata list)
export interface PropertyDocMeta {
  id: string;
  propertyId: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export async function listPropertyDocs(
  propertyId: string
): Promise<PropertyDocMeta[]> {
  const q = query(
    collection(firestore, COL_PROPERTY_DOCS),
    where("propertyId", "==", propertyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PropertyDocMeta, "id">),
  }));
}

export async function addPropertyDoc(
  meta: Omit<PropertyDocMeta, "id" | "uploadedAt">
): Promise<PropertyDocMeta> {
  const payload = { ...meta, uploadedAt: new Date().toISOString() };
  const docRef = await addDoc(
    collection(firestore, COL_PROPERTY_DOCS),
    payload
  );
  return { id: docRef.id, ...(payload as Omit<PropertyDocMeta, "id">) };
}

export async function deletePropertyDoc(id: string): Promise<void> {
  const ref = doc(firestore, COL_PROPERTY_DOCS, id);
  await deleteDoc(ref);
}
// Cascade delete helper: remove related docs by propertyId (client-side)
async function cascadeDeleteByProperty(propertyId: string) {
  const collections = [
    COL_LEASES,
    COL_RECURRING,
    COL_ONEOFF,
    COL_LOANS,
    COL_ROOMS,
  ];
  for (const col of collections) {
    const q = query(
      collection(firestore, col),
      where("propertyId", "==", propertyId)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
}

/* Legacy in-memory implementation retained for reference:
   (Removed for brevity in production – see previous git history if needed)
*/
