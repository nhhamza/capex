import dayjs, { Dayjs } from "dayjs";

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
