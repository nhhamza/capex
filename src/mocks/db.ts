import {
  Property,
  Lease,
  RecurringExpense,
  OneOffExpense,
  Loan,
} from "@/modules/properties/types";

// In-memory database (LEGACY) kept only for seed migration & tests.
// Firestore is now the primary data store. Avoid adding new logic here.
export const db = {
  properties: [] as Property[],
  leases: [] as Lease[],
  recurringExpenses: [] as RecurringExpense[],
  oneOffExpenses: [] as OneOffExpense[],
  loans: [] as Loan[],
};

// Helper to generate IDs
let idCounter = 1;
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${idCounter++}`;
}

// Filter by organizationId
export function filterByOrg<T extends { organizationId?: string }>(
  items: T[],
  orgId: string
): T[] {
  return items.filter((item) => item.organizationId === orgId);
}

export function filterByProperty<T extends { propertyId: string }>(
  items: T[],
  propertyId: string
): T[] {
  return items.filter((item) => item.propertyId === propertyId);
}
