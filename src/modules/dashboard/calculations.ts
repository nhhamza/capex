/**
 * Dashboard Calculation Utilities
 * Pure functions for computing financial metrics
 */

import dayjs from "dayjs";
import type {
  Property,
  OneOffExpense,
  RecurringExpense,
} from "@/modules/properties/types";

/**
 * Get the start of current month (ISO string)
 */
export function getCurrentMonthStart(): string {
  return dayjs().startOf("month").toISOString();
}

/**
 * Get the end of current month (ISO string)
 */
export function getCurrentMonthEnd(): string {
  return dayjs().endOf("month").toISOString();
}

/**
 * Get the start of previous month (ISO string)
 */
export function getPreviousMonthStart(): string {
  return dayjs().subtract(1, "month").startOf("month").toISOString();
}

/**
 * Get the end of previous month (ISO string)
 */
export function getPreviousMonthEnd(): string {
  return dayjs().subtract(1, "month").endOf("month").toISOString();
}

/**
 * Get the start of current year (ISO string)
 */
export function getCurrentYearStart(): string {
  return dayjs().startOf("year").toISOString();
}

/**
 * Filter expenses by date range
 */
export function filterExpensesByDateRange(
  expenses: OneOffExpense[],
  startDate: string,
  endDate: string,
): OneOffExpense[] {
  return expenses.filter((exp) => {
    const expDate = dayjs(exp.date);
    return expDate.isAfter(startDate) && expDate.isBefore(endDate);
  });
}

/**
 * Calculate YTD (Year-to-Date) cashflow
 * = Total income (YTD) - Total expenses (YTD) - Loan payments (YTD)
 */
export function calculateYTDCashflow(
  totalIncomeYTD: number,
  totalExpensesYTD: number,
  totalDebtServiceYTD: number,
): number {
  return totalIncomeYTD - totalExpensesYTD - totalDebtServiceYTD;
}

/**
 * Calculate current month cashflow
 * Returns the estimated monthly cashflow
 */
export function calculateCurrentMonthCashflow(
  totalIncome: number,
  totalRecurringExpenses: number,
  totalOneOffExpenses: number,
  debtService: number,
): number {
  return (
    totalIncome - totalRecurringExpenses - totalOneOffExpenses - debtService
  );
}

/**
 * Calculate 12-month projection
 * Assumes current monthly average continues throughout year
 */
export function calculateYearProjection(monthlyAverage: number): number {
  return monthlyAverage * 12;
}

/**
 * Determine trend: compare current month to previous month
 * Returns: "up" | "down" | "neutral"
 */
export function determineTrend(
  currentMonth: number,
  previousMonth: number,
): "up" | "down" | "neutral" {
  if (currentMonth > previousMonth * 1.05) return "up"; // 5% threshold
  if (currentMonth < previousMonth * 0.95) return "down";
  return "neutral";
}

/**
 * Calculate monthly cashflow for a specific property
 */
export function calculatePropertyMonthlyCashflow(
  monthlyRent: number,
  monthlyExpenses: number,
  monthlyDebtService: number,
): number {
  return monthlyRent - monthlyExpenses - monthlyDebtService;
}

/**
 * Find property with best monthly cashflow (most positive)
 */
export function findBestPropertyByCashflow(
  properties: Property[],
  leasesMap: Map<string, any>,
  loansMap: Map<string, any>,
  expensesMap: Map<string, any>,
): { property: Property; monthlyRent: number; cashflow: number } | null {
  if (!properties || properties.length === 0) return null;

  let best: {
    property: Property;
    monthlyRent: number;
    cashflow: number;
  } | null = null;

  for (const prop of properties) {
    const lease = leasesMap.get(prop.id);
    const monthlyRent = lease?.monthlyRent || 0;

    const loans = loansMap.get(prop.id) || [];
    const monthlyDebtService = loans.reduce((sum: number, loan: any) => {
      // Simplified: assume monthly payment if available
      return sum + (loan.monthlyPayment || 0);
    }, 0);

    const expenses = expensesMap.get(prop.id) || [];
    const monthlyExpenses = expenses.reduce(
      (sum: number, exp: RecurringExpense) => {
        // Convert periodicity to monthly if needed
        const monthlyAmount =
          exp.periodicity === "yearly"
            ? exp.amount / 12
            : exp.periodicity === "quarterly"
              ? exp.amount / 3
              : exp.amount;
        return sum + (monthlyAmount || 0);
      },
      0,
    );

    const cashflow = calculatePropertyMonthlyCashflow(
      monthlyRent,
      monthlyExpenses,
      monthlyDebtService,
    );

    if (!best || cashflow > best.cashflow) {
      best = { property: prop, monthlyRent, cashflow };
    }
  }

  return best;
}

/**
 * Find property with worst monthly cashflow (least positive or most negative)
 */
export function findWorstPropertyByCashflow(
  properties: Property[],
  leasesMap: Map<string, any>,
  loansMap: Map<string, any>,
  expensesMap: Map<string, any>,
): { property: Property; monthlyRent: number; cashflow: number } | null {
  if (!properties || properties.length === 0) return null;

  let worst: {
    property: Property;
    monthlyRent: number;
    cashflow: number;
  } | null = null;

  for (const prop of properties) {
    const lease = leasesMap.get(prop.id);
    const monthlyRent = lease?.monthlyRent || 0;

    const loans = loansMap.get(prop.id) || [];
    const monthlyDebtService = loans.reduce((sum: number, loan: any) => {
      return sum + (loan.monthlyPayment || 0);
    }, 0);

    const expenses = expensesMap.get(prop.id) || [];
    const monthlyExpenses = expenses.reduce(
      (sum: number, exp: RecurringExpense) => {
        const monthlyAmount =
          exp.periodicity === "yearly"
            ? exp.amount / 12
            : exp.periodicity === "quarterly"
              ? exp.amount / 3
              : exp.amount;
        return sum + (monthlyAmount || 0);
      },
      0,
    );

    const cashflow = calculatePropertyMonthlyCashflow(
      monthlyRent,
      monthlyExpenses,
      monthlyDebtService,
    );

    if (!worst || cashflow < worst.cashflow) {
      worst = { property: prop, monthlyRent, cashflow };
    }
  }

  return worst;
}

/**
 * Calculate trend message with property context
 */
export function getTrendMessage(
  trend: "up" | "down" | "neutral",
  currentCashflow: number,
  previousCashflow: number,
  worstPropertyName?: string,
): string {
  const diff = currentCashflow - previousCashflow;

  if (trend === "up") {
    return `¡Excelente! Tu cashflow ha mejorado ${Math.abs(diff).toFixed(0)}€ respecto al mes anterior.`;
  } else if (trend === "down") {
    const detail = worstPropertyName
      ? ` Revisa especialmente ${worstPropertyName}.`
      : "";
    return `Tu cashflow ha bajado ${Math.abs(diff).toFixed(0)}€ vs mes anterior.${detail}`;
  } else {
    return "Tu cashflow se mantiene estable respecto al mes anterior.";
  }
}
