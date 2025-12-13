// src/modules/properties/rentalAggregation.ts
import dayjs, { Dayjs } from "dayjs";
import { Property, Lease, Room } from "./types";

export interface AggregatedRentResult {
  monthlyGross: number;          // suma de rentas brutas (sin vacancia)
  monthlyNet: number;            // renta neta después de vacancias
  effectiveVacancyPct: number;   // 0..1 -> (1 - net/gross) si gross > 0
  occupiedRooms: number;         // nº de habitaciones con lease activo
  totalRooms: number;            // nº total de habitaciones definidas
}

interface AggregatedRentForMonthOptions {
  property: Property;
  leases: Lease[];
  rooms: Room[];
  monthDate: Dayjs;
}

/**
 * Devuelve la renta agregada de una propiedad para un mes concreto.
 * Soporta tanto ENTIRE_UNIT como PER_ROOM.
 */
export function getAggregatedRentForMonth(
  options: AggregatedRentForMonthOptions
): AggregatedRentResult {
  const { property, leases, rooms, monthDate } = options;

  // Helper para comprobar si un lease está activo en un mes concreto
  const isLeaseActiveInMonth = (lease: Lease) => {
    if (!lease.startDate) return false;
    const start = dayjs(lease.startDate);
    const end = lease.endDate ? dayjs(lease.endDate) : null;

    const startsOnOrBefore =
      monthDate.isSame(start, "month") || monthDate.isAfter(start, "month");
    const endsOnOrAfter =
      !end || monthDate.isSame(end, "month") || monthDate.isBefore(end, "month");

    return startsOnOrBefore && endsOnOrAfter;
  };

  // Caso 1: vivienda completa (modo actual)
  if (property.rentalMode === "ENTIRE_UNIT" || !property.rentalMode) {
    const activeLease = leases.find((l) => !l.roomId && isLeaseActiveInMonth(l));

    if (!activeLease) {
      return {
        monthlyGross: 0,
        monthlyNet: 0,
        effectiveVacancyPct: 0,
        occupiedRooms: 0,
        totalRooms: 1,
      };
    }

    const gross = activeLease.monthlyRent || 0;
    const net = gross * (1 - (activeLease.vacancyPct || 0));
    const effVac = gross > 0 ? 1 - net / gross : 0;

    return {
      monthlyGross: gross,
      monthlyNet: net,
      effectiveVacancyPct: effVac,
      occupiedRooms: net > 0 ? 1 : 0,
      totalRooms: 1,
    };
  }

  // Caso 2: alquiler por habitaciones
  const totalRooms = rooms.length || 0;

  const roomLeases = leases.filter(
    (l) => l.roomId && isLeaseActiveInMonth(l)
  );

  let monthlyGross = 0;
  let monthlyNet = 0;

  const occupiedRoomIds = new Set<string>();

  for (const lease of roomLeases) {
    const gross = lease.monthlyRent || 0;
    const net = gross * (1 - (lease.vacancyPct || 0));

    monthlyGross += gross;
    monthlyNet += net;

    if (lease.roomId) {
      occupiedRoomIds.add(lease.roomId);
    }
  }

  const effectiveVacancyPct =
    monthlyGross > 0 ? 1 - monthlyNet / monthlyGross : 0;

  return {
    monthlyGross,
    monthlyNet,
    effectiveVacancyPct,
    occupiedRooms: occupiedRoomIds.size,
    totalRooms,
  };
}