import { describe, it, expect } from "vitest";
import {
  monthlyPaymentFrancesa,
  buildAmortizationSchedule,
  sumClosingCosts,
  computeAnnuals,
  computeLeveredMetrics,
} from "./calculations";
import { AcquisitionCosts, RecurringExpense, Loan } from "./types";

describe("calculations", () => {
  describe("monthlyPaymentFrancesa", () => {
    it("should calculate correct monthly payment", () => {
      const payment = monthlyPaymentFrancesa(200000, 3.5, 300);
      expect(payment).toBeCloseTo(1011.31, 1);
    });

    it("should handle zero interest rate", () => {
      const payment = monthlyPaymentFrancesa(12000, 0, 12);
      expect(payment).toBe(1000);
    });
  });

  describe("buildAmortizationSchedule", () => {
    it("should build schedule without interest-only period", () => {
      const result = buildAmortizationSchedule({
        principal: 100000,
        annualRatePct: 4,
        termMonths: 12,
        interestOnlyMonths: 0,
      });

      expect(result.schedule).toHaveLength(12);
      expect(result.schedule[0].month).toBe(1);
      expect(result.schedule[11].balance).toBeCloseTo(0, 0);
    });

    it("should build schedule with interest-only period", () => {
      const result = buildAmortizationSchedule({
        principal: 100000,
        annualRatePct: 4,
        termMonths: 24,
        interestOnlyMonths: 12,
      });

      expect(result.schedule).toHaveLength(24);
      // First 12 months should have no principal paid
      expect(result.schedule[0].principalPaid).toBe(0);
      expect(result.schedule[11].principalPaid).toBe(0);
      // Month 13 should start amortizing
      expect(result.schedule[12].principalPaid).toBeGreaterThan(0);
    });
  });

  describe("sumClosingCosts", () => {
    it("should sum all costs", () => {
      const costs: AcquisitionCosts = {
        itp: 25000,
        notary: 1200,
        registry: 800,
        ajd: 1500,
        initialRenovation: 15000,
        appliances: 3000,
        others: 500,
      };
      expect(sumClosingCosts(costs)).toBe(47000);
    });

    it("should handle undefined costs", () => {
      expect(sumClosingCosts(undefined)).toBe(0);
    });

    it("should handle partial costs", () => {
      const costs: AcquisitionCosts = {
        itp: 10000,
        notary: 1000,
      };
      expect(sumClosingCosts(costs)).toBe(11000);
    });
  });

  describe("computeAnnuals", () => {
    it("should compute unlevered metrics correctly", () => {
      const recurring: RecurringExpense[] = [
        {
          id: "1",
          propertyId: "p1",
          type: "community",
          amount: 100,
          periodicity: "monthly",
        },
        {
          id: "2",
          propertyId: "p1",
          type: "ibi",
          amount: 600,
          periodicity: "yearly",
        },
      ];

      const result = computeAnnuals({
        monthlyRent: 1000,
        vacancyPct: 0.05,
        recurring,
        variableAnnualBudget: 500,
        purchasePrice: 200000,
        closingCostsTotal: 20000,
      });

      expect(result.rentAnnualGross).toBe(11400); // 1000 * 12 * 0.95
      expect(result.recurringAnnual).toBe(1800); // 100*12 + 600
      expect(result.variableAnnual).toBe(500);
      expect(result.noi).toBe(9100); // 11400 - 1800 - 500
      expect(result.capRateNet).toBeCloseTo(4.136, 2); // (9100 / 220000) * 100
    });
  });

  describe("computeLeveredMetrics", () => {
    it("should compute levered metrics with loan", () => {
      const recurring: RecurringExpense[] = [
        {
          id: "1",
          propertyId: "p1",
          type: "community",
          amount: 100,
          periodicity: "monthly",
        },
      ];

      const loan: Loan = {
        id: "l1",
        propertyId: "p1",
        principal: 160000,
        annualRatePct: 3.5,
        termMonths: 300,
      };

      const result = computeLeveredMetrics({
        monthlyRent: 1200,
        vacancyPct: 0.05,
        recurring,
        variableAnnualBudget: 0,
        purchasePrice: 200000,
        closingCostsTotal: 20000,
        loan,
      });

      expect(result.noi).toBeGreaterThan(0);
      expect(result.ads).toBeGreaterThan(0);
      expect(result.cfaf).toBeLessThan(result.noi);
      expect(result.equity).toBe(60000); // 220000 - 160000
      expect(result.ltv).toBe(80); // (160000 / 200000) * 100
      expect(result.dscr).toBeGreaterThan(0);
    });

    it("should compute unlevered metrics without loan", () => {
      const result = computeLeveredMetrics({
        monthlyRent: 1000,
        vacancyPct: 0,
        recurring: [],
        variableAnnualBudget: 0,
        purchasePrice: 150000,
        closingCostsTotal: 15000,
      });

      expect(result.ads).toBe(0);
      expect(result.cfaf).toBe(result.noi);
      expect(result.equity).toBe(165000);
      expect(result.ltv).toBe(0);
    });
  });
});
