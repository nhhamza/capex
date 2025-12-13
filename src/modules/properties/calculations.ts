import {
  AcquisitionCosts,
  RecurringExpense,
  Loan,
  AmortizationSchedule,
  AnnualMetrics,
  LeveredMetrics,
  Property,
  Lease,
  Room,
  AggregatedRentResult,
} from "./types";
import dayjs, { Dayjs } from "dayjs";

/**
 * Calculate monthly payment for French amortization (constant payment)
 */
export function monthlyPaymentFrancesa(
  principal: number,
  annualRatePct: number,
  termMonths: number
): number {
  if (termMonths === 0 || annualRatePct === 0)
    return principal / (termMonths || 1);

  const monthlyRate = annualRatePct / 100 / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return payment;
}

/**
 * Build full amortization schedule with optional interest-only period
 */
export function buildAmortizationSchedule(params: {
  principal: number;
  annualRatePct: number;
  termMonths: number;
  interestOnlyMonths?: number;
}): AmortizationSchedule {
  const {
    principal,
    annualRatePct,
    termMonths,
    interestOnlyMonths = 0,
  } = params;
  const monthlyRate = annualRatePct / 100 / 12;

  const schedule: AmortizationSchedule["schedule"] = [];
  let balance = principal;

  // Interest-only period
  for (let month = 1; month <= interestOnlyMonths; month++) {
    const interest = balance * monthlyRate;
    schedule.push({
      month,
      payment: interest,
      interest,
      principalPaid: 0,
      balance,
    });
  }

  // Amortization period
  const amortMonths = termMonths - interestOnlyMonths;
  const payment = monthlyPaymentFrancesa(balance, annualRatePct, amortMonths);

  for (let month = interestOnlyMonths + 1; month <= termMonths; month++) {
    const interest = balance * monthlyRate;
    const principalPaid = payment - interest;
    balance = Math.max(0, balance - principalPaid);

    schedule.push({
      month,
      payment,
      interest,
      principalPaid,
      balance,
    });
  }

  return {
    payment:
      interestOnlyMonths > 0
        ? payment
        : monthlyPaymentFrancesa(principal, annualRatePct, termMonths),
    schedule,
  };
}

/**
 * Sum all acquisition/closing costs
 */
export function sumClosingCosts(costs?: AcquisitionCosts): number {
  if (!costs) return 0;

  return (
    (costs.itp || 0) +
    (costs.notary || 0) +
    (costs.registry || 0) +
    (costs.ajd || 0) +
    (costs.initialRenovation || 0) +
    (costs.appliances || 0) +
    (costs.others || 0)
  );
}

/**
 * Annualize a recurring expense based on its periodicity
 */
function annualizeExpense(
  amount: number,
  periodicity: RecurringExpense["periodicity"]
): number {
  switch (periodicity) {
    case "monthly":
      return amount * 12;
    case "quarterly":
      return amount * 4;
    case "yearly":
      return amount;
    default:
      return 0;
  }
}

/**
 * Compute unlevered (no debt) annual metrics
 */
export function computeAnnuals(params: {
  monthlyRent: number;
  vacancyPct?: number;
  recurring: RecurringExpense[];
  variableAnnualBudget?: number;
  purchasePrice: number;
  closingCostsTotal?: number;
}): AnnualMetrics {
  const {
    monthlyRent,
    vacancyPct = 0,
    recurring,
    variableAnnualBudget = 0,
    purchasePrice,
    closingCostsTotal = 0,
  } = params;

  const rentAnnualGross = monthlyRent * 12 * (1 - vacancyPct);
  const recurringAnnual = recurring.reduce(
    (sum, exp) => sum + annualizeExpense(exp.amount, exp.periodicity),
    0
  );
  const variableAnnual = variableAnnualBudget;

  const noi = rentAnnualGross - recurringAnnual - variableAnnual;
  const totalInvestment = purchasePrice + closingCostsTotal;
  const capRateNet = totalInvestment > 0 ? (noi / totalInvestment) * 100 : 0;
  const yieldGross =
    totalInvestment > 0 ? (rentAnnualGross / totalInvestment) * 100 : 0;

  return {
    rentAnnualGross,
    recurringAnnual,
    variableAnnual,
    noi,
    capRateNet,
    yieldGross,
  };
}

/**
 * Compute levered (with debt) metrics
 */
export function computeLeveredMetrics(params: {
  monthlyRent: number;
  vacancyPct?: number;
  recurring: RecurringExpense[];
  variableAnnualBudget?: number;
  purchasePrice: number;
  closingCostsTotal?: number;
  loan?: Loan;
  currentValue?: number; // optional updated market value
}): LeveredMetrics {
  const annuals = computeAnnuals(params);
  const { purchasePrice, closingCostsTotal = 0, loan, currentValue } = params;

  if (!loan) {
    // No debt case
    return {
      ...annuals,
      ads: 0,
      interestsAnnual: 0,
      principalAnnual: 0,
      cfaf: annuals.noi,
      equity: purchasePrice + closingCostsTotal,
      cashOnCash: annuals.capRateNet,
      dscr: 0,
      ltv: 0,
    };
  }

  const { payment, schedule } = buildAmortizationSchedule({
    principal: loan.principal,
    annualRatePct: loan.annualRatePct,
    termMonths: loan.termMonths,
    interestOnlyMonths: loan.interestOnlyMonths,
  });

  const ads = payment * 12;

  // First year interests and principal
  const firstYearPayments = schedule.slice(0, Math.min(12, schedule.length));
  const interestsAnnual = firstYearPayments.reduce(
    (sum, row) => sum + row.interest,
    0
  );
  const principalAnnual = firstYearPayments.reduce(
    (sum, row) => sum + row.principalPaid,
    0
  );

  const cfaf = annuals.noi - ads;
  // If currentValue provided, equity reflects market value minus principal; else use purchase basis
  const effectiveValue =
    typeof currentValue === "number" && currentValue > 0
      ? currentValue
      : purchasePrice;
  const equity = effectiveValue + closingCostsTotal - loan.principal;
  const cashOnCash = equity > 0 ? (cfaf / equity) * 100 : 0;
  const dscr = ads > 0 ? annuals.noi / ads : 0;
  // Dynamic LTV using currentValue if available
  const ltv = effectiveValue > 0 ? (loan.principal / effectiveValue) * 100 : 0;

  return {
    ...annuals,
    ads,
    interestsAnnual,
    principalAnnual,
    cfaf,
    equity,
    cashOnCash,
    dscr,
    ltv,
  };
}

/**
 * Get aggregated rent for a specific month
 * Handles both ENTIRE_UNIT and PER_ROOM rental modes
 */
export interface AggregatedRentForMonthOptions {
  property: Property;
  leases: Lease[];
  rooms: Room[];
  monthDate: Dayjs;
}

export function getAggregatedRentForMonth(
  options: AggregatedRentForMonthOptions
): AggregatedRentResult {
  const { property, leases, rooms, monthDate } = options;

  // Helper: Check if a lease is active during a specific month
  const isLeaseActiveInMonth = (lease: Lease, month: Dayjs): boolean => {
    const startDate = dayjs(lease.startDate).startOf("day");
    const endDate = lease.endDate ? dayjs(lease.endDate).startOf("day") : null;
    const monthStart = month.startOf("month");
    const monthEnd = month.endOf("month");

    // Lease must start before or during the month
    if (startDate.isAfter(monthEnd)) return false;

    // If lease has an end date, it must end after the month starts
    if (endDate && endDate.isBefore(monthStart)) return false;

    return true;
  };

  // Case 1: ENTIRE_UNIT mode
  if (property.rentalMode === "ENTIRE_UNIT" || !property.rentalMode) {
    // Find active lease for this month
    const activeLease = leases.find(
      (l) => !l.roomId && isLeaseActiveInMonth(l, monthDate)
    );

    if (!activeLease) {
      return {
        monthlyGross: 0,
        monthlyNet: 0,
        effectiveVacancyPct: 0,
        occupiedRooms: 0,
        totalRooms: 1,
      };
    }

    const monthlyGross = activeLease.monthlyRent;
    const vacancyPct = activeLease.vacancyPct || 0;
    const monthlyNet = monthlyGross * (1 - vacancyPct);
    const effectiveVacancyPct =
      monthlyGross > 0 ? 1 - monthlyNet / monthlyGross : 0;

    return {
      monthlyGross,
      monthlyNet,
      effectiveVacancyPct,
      occupiedRooms: 1,
      totalRooms: 1,
    };
  }

  // Case 2: PER_ROOM mode
  const totalRooms = rooms.length || 0;

  // Get active leases for this month with roomId
  const activeLeases = leases.filter(
    (l) => l.roomId && isLeaseActiveInMonth(l, monthDate)
  );

  if (activeLeases.length === 0) {
    return {
      monthlyGross: 0,
      monthlyNet: 0,
      effectiveVacancyPct: 0,
      occupiedRooms: 0,
      totalRooms,
    };
  }

  // Calculate aggregated rent
  const monthlyGross = activeLeases.reduce(
    (sum, lease) => sum + (lease.monthlyRent || 0),
    0
  );

  const monthlyNet = activeLeases.reduce((sum, lease) => {
    const vacancyPct = lease.vacancyPct || 0;
    return sum + (lease.monthlyRent || 0) * (1 - vacancyPct);
  }, 0);

  const effectiveVacancyPct =
    monthlyGross > 0 ? 1 - monthlyNet / monthlyGross : 0;

  // Count occupied rooms (rooms with at least one active lease)
  const occupiedRoomIds = new Set(activeLeases.map((l) => l.roomId));
  const occupiedRooms = occupiedRoomIds.size;

  return {
    monthlyGross,
    monthlyNet,
    effectiveVacancyPct,
    occupiedRooms,
    totalRooms,
  };
}

/**
 * Get aggregated rent for a specific year
 * Sums monthly aggregates for all 12 months
 */
export interface AggregatedRentForYearOptions {
  property: Property;
  leases: Lease[];
  rooms: Room[];
  year: number;
}

export interface AggregatedRentForYearResult {
  annualGross: number;
  annualNet: number;
  averageEffectiveVacancyPct: number;
}

export function getAggregatedRentForYear(
  options: AggregatedRentForYearOptions
): AggregatedRentForYearResult {
  const { property, leases, rooms, year } = options;

  let totalMonthlyGross = 0;
  let totalMonthlyNet = 0;
  const monthlyVacancyRates: number[] = [];

  // Calculate for each month
  for (let month = 0; month < 12; month++) {
    const monthDate = dayjs(`${year}-${String(month + 1).padStart(2, "0")}-15`);

    const monthResult = getAggregatedRentForMonth({
      property,
      leases,
      rooms,
      monthDate,
    });

    totalMonthlyGross += monthResult.monthlyGross;
    totalMonthlyNet += monthResult.monthlyNet;
    monthlyVacancyRates.push(monthResult.effectiveVacancyPct);
  }

  // Calculate average vacancy rate
  const averageEffectiveVacancyPct =
    monthlyVacancyRates.length > 0
      ? monthlyVacancyRates.reduce((sum, rate) => sum + rate, 0) /
        monthlyVacancyRates.length
      : 0;

  return {
    annualGross: totalMonthlyGross,
    annualNet: totalMonthlyNet,
    averageEffectiveVacancyPct,
  };
}
