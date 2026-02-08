import { describe, it, expect } from "vitest";
import {
  calculateYTDCashflow,
  calculateCurrentMonthCashflow,
  calculateYearProjection,
  determineTrend,
  calculatePropertyMonthlyCashflow,
  getTrendMessage,
} from "./calculations";

describe("Dashboard Calculation Helpers", () => {
  describe("calculateYTDCashflow", () => {
    it("should calculate positive cashflow", () => {
      const result = calculateYTDCashflow(12000, 3000, 2000);
      expect(result).toBe(7000);
    });

    it("should calculate negative cashflow", () => {
      const result = calculateYTDCashflow(5000, 8000, 2000);
      expect(result).toBe(-5000);
    });

    it("should handle zero values", () => {
      const result = calculateYTDCashflow(0, 0, 0);
      expect(result).toBe(0);
    });

    it("should handle decimal values", () => {
      const result = calculateYTDCashflow(12500.5, 3200.3, 1999.7);
      expect(result).toBeCloseTo(7300.5, 1);
    });
  });

  describe("calculateCurrentMonthCashflow", () => {
    it("should calculate monthly cashflow correctly", () => {
      const result = calculateCurrentMonthCashflow(1500, 400, 100, 300);
      expect(result).toBe(700);
    });

    it("should handle zero monthly income", () => {
      const result = calculateCurrentMonthCashflow(0, 100, 50, 100);
      expect(result).toBe(-250);
    });

    it("should calculate with no expenses or debt", () => {
      const result = calculateCurrentMonthCashflow(1000, 0, 0, 0);
      expect(result).toBe(1000);
    });
  });

  describe("calculateYearProjection", () => {
    it("should project positive monthly cashflow to year", () => {
      const result = calculateYearProjection(500);
      expect(result).toBe(6000);
    });

    it("should project negative monthly cashflow to year", () => {
      const result = calculateYearProjection(-200);
      expect(result).toBe(-2400);
    });

    it("should handle zero", () => {
      const result = calculateYearProjection(0);
      expect(result).toBe(0);
    });

    it("should handle decimal values", () => {
      const result = calculateYearProjection(123.45);
      expect(result).toBeCloseTo(1481.4, 1);
    });
  });

  describe("determineTrend", () => {
    it("should detect uptrend (>5% increase)", () => {
      const result = determineTrend(1051, 1000);
      expect(result).toBe("up");
    });

    it("should detect downtrend (<5% decrease)", () => {
      const result = determineTrend(949, 1000);
      expect(result).toBe("down");
    });

    it("should detect neutral trend (within 5%)", () => {
      const result = determineTrend(1020, 1000);
      expect(result).toBe("neutral");
    });

    it("should handle equal values", () => {
      const result = determineTrend(1000, 1000);
      expect(result).toBe("neutral");
    });

    it("should handle negative values", () => {
      const result = determineTrend(-500, -1000);
      expect(result).toBe("up"); // -500 > -1000 * 1.05
    });
  });

  describe("calculatePropertyMonthlyCashflow", () => {
    it("should calculate positive cashflow", () => {
      const result = calculatePropertyMonthlyCashflow(1000, 200, 300);
      expect(result).toBe(500);
    });

    it("should calculate negative cashflow", () => {
      const result = calculatePropertyMonthlyCashflow(800, 400, 600);
      expect(result).toBe(-200);
    });

    it("should handle no debt service", () => {
      const result = calculatePropertyMonthlyCashflow(1200, 150, 0);
      expect(result).toBe(1050);
    });

    it("should handle no expenses", () => {
      const result = calculatePropertyMonthlyCashflow(1500, 0, 500);
      expect(result).toBe(1000);
    });
  });

  describe("getTrendMessage", () => {
    it("should return up trend message", () => {
      const result = getTrendMessage("up", 1000, 800);
      expect(result).toContain("mejorado");
      expect(result).toContain("200");
    });

    it("should return down trend message without property", () => {
      const result = getTrendMessage("down", 600, 800);
      expect(result).toContain("bajado");
      expect(result).toContain("200");
    });

    it("should return down trend message with property name", () => {
      const result = getTrendMessage("down", 600, 800, "Apartamento Centro");
      expect(result).toContain("bajado");
      expect(result).toContain("Apartamento Centro");
    });

    it("should return neutral trend message", () => {
      const result = getTrendMessage("neutral", 800, 800);
      expect(result).toContain("mantiene estable");
    });

    it("should handle negative differences", () => {
      const result = getTrendMessage("down", -100, 100);
      expect(result).toContain("200");
    });
  });
});
