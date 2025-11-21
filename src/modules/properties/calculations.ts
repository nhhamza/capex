import {
  AcquisitionCosts,
  RecurringExpense,
  Loan,
  AmortizationSchedule,
  AnnualMetrics,
  LeveredMetrics,
} from "./types";

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
