import dayjs, { Dayjs } from "dayjs";
import type { Lease } from "@/modules/properties/types";

export function formatDate(date: string | Date | Dayjs | undefined): string {
  if (!date) return "-";
  return dayjs(date).format("DD/MM/YYYY");
}

export function parseDate(date: string | undefined): Dayjs | null {
  if (!date) return null;
  return dayjs(date);
}

export function toISOString(date: Dayjs | null): string | undefined {
  if (!date) return undefined;
  // Guard against invalid Dayjs objects
  if (!date.isValid()) return undefined;
  try {
    return date.toDate().toISOString();
  } catch {
    return undefined;
  }
}

export function isLeaseActiveToday(
  startDate?: string | Date,
  endDate?: string | Date
): boolean {
  if (!startDate) return false;
  
  const today = dayjs().startOf("day");
  const start = dayjs(startDate).startOf("day");
  
  // Si no hay fecha de fin, el lease continúa indefinidamente
  if (!endDate) {
    return !today.isBefore(start);
  }
  
  const end = dayjs(endDate).startOf("day");
  // Verificar que hoy esté entre start y end (inclusive)
  return !today.isBefore(start) && !today.isAfter(end);
}

// Lease activity helpers
export function isLeaseActive(lease: Lease, now: Dayjs = dayjs()): boolean {
  if (!lease.startDate) return false;
  
  const start = dayjs(lease.startDate).startOf("day");
  
  // If no end date, lease continues indefinitely
  if (!lease.endDate) {
    return !now.isBefore(start);
  }
  
  const end = dayjs(lease.endDate).startOf("day");
  // Check that now is between start and end (inclusive)
  return !now.isBefore(start) && !now.isAfter(end);
}

export function getActiveUnitLease(leases: Lease[]): Lease | null {
  return leases.find((lease) => !lease.roomId && isLeaseActive(lease)) || null;
}

export function getActiveRoomLease(leases: Lease[], roomId: string): Lease | null {
  return leases.find((lease) => lease.roomId === roomId && isLeaseActive(lease)) || null;
}

