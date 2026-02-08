import { Property, RecurringExpense } from "./types";
import { computeLeveredMetrics, sumClosingCosts } from "./calculations";

/**
 * Alert structure for property cards
 */
export interface PropertyAlert {
  severity: "error" | "warning" | "info" | "success";
  message: string;
}

/**
 * Property card data with calculated metrics
 */
export interface PropertyCardData {
  property: Property;
  monthlyRentGross: number; // Gross rent before vacancy deduction
  cashflow: number;
  roi: number;
  occupancyRate: number;
  vacantDays: number;
  equity: number;
  equityPercent: number;
  alerts: PropertyAlert[];
}

/**
 * Calculate all metrics needed for property card display
 * Now uses computeLeveredMetrics for accurate calculations
 */
export function calculatePropertyCardData(
  property: Property,
  monthlyRent: number,
  monthlyRentGross: number, // Gross rent before vacancy
  recurringExpenses: RecurringExpense[],
  loan: any | null,
  occupancyRate: number,
): PropertyCardData {
  // Use computeLeveredMetrics for consistent calculations across the app
  const closingCostsTotal = sumClosingCosts(property.closingCosts);

  const metrics = computeLeveredMetrics({
    monthlyRent, // Already NET (after vacancy)
    vacancyPct: 0, // Already applied in monthlyRent
    recurring: recurringExpenses,
    variableAnnualBudget: 0,
    purchasePrice: property.purchasePrice,
    closingCostsTotal,
    currentValue: property.currentValue,
    loan: loan || undefined,
  });

  // Extract metrics from computeLeveredMetrics
  const cashflow = metrics.cfaf / 12; // Monthly cashflow
  const roi = metrics.cashOnCash; // Cash-on-Cash ROI

  // 3. Calcular días vacíos
  let vacantDays = 0;

  if (occupancyRate < 100) {
    // Simple estimation: if occupancy < 100, estimate vacant days proportionally
    vacantDays = Math.round((30 * (100 - occupancyRate)) / 100);
  }

  // 4. Calcular equity (from metrics)
  const equity = metrics.equity;
  const currentValue = property.currentValue || property.purchasePrice;
  const equityPercent = currentValue > 0 ? (equity / currentValue) * 100 : 0;

  // 5. Generar alertas inteligentes
  const alerts: PropertyAlert[] = [];

  // Alerta: Cashflow negativo
  if (cashflow < 0) {
    alerts.push({
      severity: "error",
      message: `Pérdidas de €${Math.abs(cashflow).toFixed(2)}/mes`,
    });
  }

  // Alerta: Sin contrato
  if (monthlyRent === 0) {
    alerts.push({
      severity: "warning",
      message: "Sin contrato de arrendamiento",
    });
  }

  // Alerta: Vacío más de 30 días
  if (vacantDays > 30) {
    alerts.push({
      severity: "error",
      message: `${vacantDays} días sin inquilino`,
    });
  }

  // Alerta: ROI bajo (< 4%)
  if (roi > 0 && roi < 4) {
    alerts.push({
      severity: "warning",
      message: `ROI bajo: ${roi.toFixed(1)}% (objetivo: >6%)`,
    });
  }

  // Alerta positiva: ROI excelente (> 8%)
  if (roi > 8) {
    alerts.push({
      severity: "success",
      message: `¡Excelente ROI: ${roi.toFixed(1)}%!`,
    });
  }

  return {
    property,
    monthlyRentGross,
    cashflow,
    roi,
    occupancyRate,
    vacantDays,
    equity,
    equityPercent,
    alerts,
  };
}

/**
 * Sort properties by a given key
 */
export function sortProperties(
  properties: PropertyCardData[],
  sortBy: string,
): PropertyCardData[] {
  const sorted = [...properties];

  switch (sortBy) {
    case "cashflow-desc":
      sorted.sort((a, b) => b.cashflow - a.cashflow);
      break;
    case "cashflow-asc":
      sorted.sort((a, b) => a.cashflow - b.cashflow);
      break;
    case "roi-desc":
      sorted.sort((a, b) => b.roi - a.roi);
      break;
    case "date-desc":
      sorted.sort(
        (a, b) =>
          new Date(b.property.purchaseDate || 0).getTime() -
          new Date(a.property.purchaseDate || 0).getTime(),
      );
      break;
    case "address":
      sorted.sort((a, b) =>
        a.property.address.localeCompare(b.property.address),
      );
      break;
    default:
      break;
  }

  return sorted;
}

/**
 * Filter properties by a given filter key
 */
export function filterProperties(
  properties: PropertyCardData[],
  filter: string,
): PropertyCardData[] {
  switch (filter) {
    case "positive":
      return properties.filter((p) => p.cashflow > 0);
    case "negative":
      return properties.filter((p) => p.cashflow < 0);
    case "vacant":
      return properties.filter((p) => p.occupancyRate < 100);
    case "expiring":
      return properties.filter((p) => p.vacantDays > 0 && p.vacantDays <= 30);
    case "all":
    default:
      return properties;
  }
}
