export type Periodicity = "monthly" | "quarterly" | "yearly";

export type RentalMode = "ENTIRE_UNIT" | "PER_ROOM";

export interface AcquisitionCosts {
  itp?: number;
  notary?: number;
  registry?: number;
  ajd?: number;
  initialRenovation?: number;
  appliances?: number;
  others?: number;
}

export interface Property {
  id: string;
  organizationId: string;
  address: string;
  city?: string;
  zip?: string;
  notes?: string;
  purchasePrice: number;
  purchaseDate?: string;
  currentValue?: number; // Valor actual del inmueble para métricas (LTV dinámico, yield actual)
  closingCosts?: AcquisitionCosts;
  images?: string[];
  rentalMode?: RentalMode; // "ENTIRE_UNIT" (por defecto) o "PER_ROOM"
}

export interface Lease {
  id: string;
  propertyId: string;
  roomId?: string; // Si está definido, es un lease de habitación; si es undefined, es de vivienda completa
  tenantName?: string;
  tenantPhone?: string;
  tenantDNI?: string;
  tenantEmail?: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit?: number;
  indexationRule?: "none" | "ipc" | "cap3" | "custom";
  vacancyPct?: number; // 0..1
  contractUrl?: string; // Scanned contract document
  notes?: string;
  isActive?: boolean; // To mark current active lease
}

export interface RecurringExpense {
  id: string;
  propertyId: string;
  type: "community" | "ibi" | "insurance" | "garbage" | "adminFee" | "other";
  amount: number;
  periodicity: Periodicity;
  nextDueDate?: string;
  isDeductible?: boolean; // Para Hacienda
  notes?: string;
}

export interface OneOffExpense {
  id: string;
  propertyId: string;
  date: string;
  amount: number;
  category:
    | "renovation" // Reforma
    | "repair" // Reparación
    | "maintenance" // Mantenimiento
    | "furniture" // Mobiliario
    | "appliance" // Electrodoméstico
    | "improvement" // Mejora
    | "legal" // Gastos legales
    | "agency" // Agencia
    | "other"; // Otro
  description: string;
  vendor?: string;
  invoiceNumber?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  isDeductible?: boolean; // Para Hacienda
  notes?: string;
}

export interface Loan {
  id: string;
  propertyId: string;
  principal: number;
  annualRatePct: number;
  termMonths: number;
  startDate?: string;
  interestOnlyMonths?: number;
  upFrontFees?: number;
  notes?: string;
}

export interface Room {
  id: string;
  propertyId: string;
  name: string; // "Hab 1", "Suite interior", etc.
  sizeM2?: number;
  floor?: string;
  notes?: string;
  isActive: boolean;
}

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principalPaid: number;
  balance: number;
}

export interface AmortizationSchedule {
  payment: number;
  schedule: AmortizationRow[];
}

export interface AnnualMetrics {
  rentAnnualGross: number;
  recurringAnnual: number;
  variableAnnual: number;
  noi: number;
  capRateNet: number;
  yieldGross: number;
}

export interface LeveredMetrics extends AnnualMetrics {
  ads: number;
  interestsAnnual: number;
  principalAnnual: number;
  cfaf: number;
  equity: number;
  cashOnCash: number;
  dscr: number;
  ltv: number;
}

export interface AggregatedRentResult {
  monthlyGross: number;
  monthlyNet: number;
  effectiveVacancyPct: number;
  occupiedRooms: number;
  totalRooms: number;
}
