import { backendApi } from "@/lib/backendApi";
import type {
  Property,
  Lease,
  RecurringExpense,
  OneOffExpense,
  Loan,
  Room,
} from "./types";

/**
 * Canonical doc meta type used by UI.
 * Keep organizationId required for multi-tenant consistency.
 */
export type PropertyDocMeta = {
  id: string;
  propertyId: string;
  organizationId: string;
  name: string;
  url: string;
  uploadedAt?: string;
  storagePath?: string;
  mimeType?: string;
  size?: number;
};

// ------------------------------
// Dashboard (parallel backend)
// ------------------------------

export async function getDashboard(): Promise<{
  properties: Property[];
  leases: Lease[];
  loans: Loan[];
  rooms: Room[];
  recurringExpenses: RecurringExpense[];
  oneOffExpenses: OneOffExpense[];
  propertyDocs: PropertyDocMeta[];
  dealScenarios: any[];
}> {
  const r = await backendApi.get("/api/dashboard");
  const data = r.data ?? {};
  return {
    properties: (data.properties ?? []) as Property[],
    leases: (data.leases ?? []) as Lease[],
    loans: (data.loans ?? []) as Loan[],
    rooms: (data.rooms ?? []) as Room[],
    recurringExpenses: (data.recurringExpenses ?? []) as RecurringExpense[],
    oneOffExpenses: (data.oneOffExpenses ?? []) as OneOffExpense[],
    propertyDocs: (data.propertyDocs ?? []) as PropertyDocMeta[],
    dealScenarios: (data.dealScenarios ?? []) as any[],
  };
}

// ------------------------------
// Properties CRUD
// ------------------------------

export async function getProperties(
  _organizationId?: string
): Promise<Property[]> {
  // organizationId is inferred server-side from the ID token
  const r = await backendApi.get("/api/properties");
  const data = r.data ?? {};
  return (data.properties ?? []) as Property[];
}

export async function getProperty(id: string): Promise<Property | undefined> {
  const props = await getProperties();
  return props.find((p) => p.id === id);
}

export async function createProperty(
  data: Omit<Property, "id">
): Promise<Property> {
  const r = await backendApi.post("/api/properties", data);
  return r.data?.property as Property;
}

export async function updateProperty(
  id: string,
  data: Partial<Property>
): Promise<Property> {
  const r = await backendApi.put(`/api/properties/${id}`, data);
  return r.data?.property as Property;
}

export async function deleteProperty(id: string): Promise<void> {
  await backendApi.delete(`/api/properties/${id}`);
}

// ------------------------------
// Generic child collections
// ------------------------------

async function listChild<T>(col: string, propertyId?: string): Promise<T[]> {
  const r = await backendApi.get(`/api/${col}`, {
    params: propertyId ? { propertyId } : undefined,
  });
  const data = r.data ?? {};
  return (data.items ?? []) as T[];
}

async function createChild<T>(col: string, payload: any): Promise<T> {
  const r = await backendApi.post(`/api/${col}`, payload);
  return r.data?.item as T;
}

async function updateChild<T>(
  col: string,
  id: string,
  payload: any
): Promise<T> {
  const r = await backendApi.put(`/api/${col}/${id}`, payload);
  return r.data?.item as T;
}

async function deleteChild(col: string, id: string): Promise<void> {
  await backendApi.delete(`/api/${col}/${id}`);
}

// ------------------------------
// Leases
// ------------------------------

export const getLeases = (propertyId: string) =>
  listChild<Lease>("leases", propertyId);

export async function getLease(propertyId: string) {
  const items = await getLeases(propertyId);
  return items[0];
}

export const createLease = (data: Omit<Lease, "id">) =>
  createChild<Lease>("leases", data);
export const updateLease = (id: string, data: Partial<Lease>) =>
  updateChild<Lease>("leases", id, data);
export const deleteLease = (id: string) => deleteChild("leases", id);

// ------------------------------
// Loans
// ------------------------------

export const getLoans = (propertyId: string) =>
  listChild<Loan>("loans", propertyId);

export async function getLoan(propertyId: string) {
  const items = await getLoans(propertyId);
  return items[0];
}

export const createLoan = (data: Omit<Loan, "id">) =>
  createChild<Loan>("loans", data);
export const updateLoan = (id: string, data: Partial<Loan>) =>
  updateChild<Loan>("loans", id, data);
export const deleteLoan = (id: string) => deleteChild("loans", id);

// ------------------------------
// Rooms
// ------------------------------

export const getRooms = (propertyId: string) =>
  listChild<Room>("rooms", propertyId);
export const createRoom = (data: Omit<Room, "id">) =>
  createChild<Room>("rooms", data);
export const updateRoom = (id: string, data: Partial<Room>) =>
  updateChild<Room>("rooms", id, data);
export const deleteRoom = (id: string) => deleteChild("rooms", id);

// ------------------------------
// Expenses
// ------------------------------

export const getRecurringExpenses = (propertyId: string) =>
  listChild<RecurringExpense>("recurringExpenses", propertyId);

export const createRecurringExpense = (data: Omit<RecurringExpense, "id">) =>
  createChild<RecurringExpense>("recurringExpenses", data);

export const updateRecurringExpense = (
  id: string,
  data: Partial<RecurringExpense>
) => updateChild<RecurringExpense>("recurringExpenses", id, data);

export const deleteRecurringExpense = (id: string) =>
  deleteChild("recurringExpenses", id);

export const getOneOffExpenses = (propertyId: string) =>
  listChild<OneOffExpense>("oneOffExpenses", propertyId);

export const createOneOffExpense = (data: Omit<OneOffExpense, "id">) =>
  createChild<OneOffExpense>("oneOffExpenses", data);

export const updateOneOffExpense = (id: string, data: Partial<OneOffExpense>) =>
  updateChild<OneOffExpense>("oneOffExpenses", id, data);

export const deleteOneOffExpense = (id: string) =>
  deleteChild("oneOffExpenses", id);

// ------------------------------
// PropertyDocs (upload via backend)
// ------------------------------

export const listPropertyDocs = (propertyId: string) =>
  listChild<PropertyDocMeta>("propertyDocs", propertyId);

/**
 * Upload file via backend (multipart/form-data).
 * IMPORTANT: Do not set Content-Type header manually; axios will set boundary.
 */
export async function uploadPropertyDoc(
  propertyId: string,
  file: File,
  name?: string
): Promise<PropertyDocMeta> {
  const form = new FormData();
  form.append("file", file);
  form.append("propertyId", propertyId);
  if (name) form.append("name", name);

  const r = await backendApi.post("/api/propertyDocs/upload", form);

  // backend returns { doc: {...} }
  return r.data?.doc as PropertyDocMeta;
}

/**
 * Backwards-compatible alias:
 * some components still import addPropertyDoc from ../api
 */
export const addPropertyDoc = async (args: {
  propertyId: string;
  name?: string;
  file?: File;
  // legacy fields (ignored in backend-first upload)
  url?: string;
}): Promise<PropertyDocMeta> => {
  if (!args.file) {
    throw new Error(
      "addPropertyDoc now requires a File. Use uploadPropertyDoc(propertyId, file)."
    );
  }
  return uploadPropertyDoc(args.propertyId, args.file, args.name);
};

export async function deletePropertyDoc(docId: string): Promise<void> {
  await backendApi.delete(`/api/propertyDocs/${docId}`);
}

// ------------------------------
// CapEx Attachments (upload via backend)
// ------------------------------

export type UploadedAttachment = {
  name: string;
  url: string;
  storagePath?: string;
  mimeType?: string;
  size?: number;
};

/**
 * Upload CapEx attachment file via backend (multipart/form-data).
 * IMPORTANT: Do not set Content-Type header manually; axios will set boundary.
 */
export async function uploadCapexAttachment(
  propertyId: string,
  file: File,
  name?: string
): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append("file", file);
  form.append("propertyId", propertyId);
  if (name) form.append("name", name);

  const r = await backendApi.post("/api/capex/upload", form);

  // backend returns { attachment: {...} }
  return r.data?.attachment as UploadedAttachment;
}
