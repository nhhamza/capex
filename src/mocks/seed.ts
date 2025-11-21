import { db, generateId } from "./db"; // LEGACY seed: used only for migration to Firestore (see firebase/migrateSeed.ts)

export function seedDatabase() {
  // NOTE: This populates the legacy in-memory DB. For Firestore first-time setup
  // use runSeedMigration() which converts this data into Firestore documents.
  const orgId = "org1";

  // Property 1
  const prop1Id = generateId("prop");
  db.properties.push({
    id: prop1Id,
    organizationId: orgId,
    address: "Calle islas canarias Nº34, P15",
    city: "Valencia",
    zip: "46023",
    purchasePrice: 59000,
    purchaseDate: "2014-09-15",
    closingCosts: {
      itp: 5900,
      notary: 1200,
      registry: 800,
      ajd: 1500,
      initialRenovation: 15000,
      appliances: 3000,
    },
  });

  db.leases.push({
    id: generateId("lease"),
    propertyId: prop1Id,
    tenantName: "María García López",
    tenantPhone: "+34 612 345 678",
    tenantDNI: "12345678A",
    tenantEmail: "maria.garcia@email.com",
    startDate: "2022-10-01",
    monthlyRent: 900,
    deposit: 900,
    indexationRule: "ipc",
    isActive: true,
  });

  db.recurringExpenses.push(
    {
      id: generateId("exp"),
      propertyId: prop1Id,
      type: "community",
      amount: 80,
      periodicity: "monthly",
      nextDueDate: "2025-11-01",
      isDeductible: true,
    },
    {
      id: generateId("exp"),
      propertyId: prop1Id,
      type: "ibi",
      amount: 250,
      periodicity: "yearly",
      nextDueDate: "2026-06-30",
      isDeductible: true,
    },
    {
      id: generateId("exp"),
      propertyId: prop1Id,
      type: "insurance",
      amount: 250,
      periodicity: "yearly",
      nextDueDate: "2025-02-01",
      isDeductible: true,
    }
  );

  db.oneOffExpenses.push(
    {
      id: generateId("capex"),
      propertyId: prop1Id,
      date: "2023-03-10",
      amount: 600,
      category: "repair",
      description: "Reparación de tubería de agua en cocina",
      vendor: "Fontanería Express",
      invoiceNumber: "INV-2023-045",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop1Id,
      date: "2025-03-15",
      amount: 450,
      category: "repair",
      description: "Reparación de persiana del salón",
      vendor: "Persianas Valencia",
      invoiceNumber: "INV-2025-012",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop1Id,
      date: "2025-07-20",
      amount: 800,
      category: "maintenance",
      description: "Pintura y mantenimiento anual",
      vendor: "Pinturas García",
      invoiceNumber: "INV-2025-089",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop1Id,
      date: "2021-04-20",
      amount: 1500,
      category: "legal",
      description: "Gastos de notaría adicionales en la compra",
      vendor: "Notaría García",
      invoiceNumber: "NOT-2021-089",
      isDeductible: false,
      notes: "Gastos relacionados con la compra inicial del inmueble",
    }
  );

  db.loans.push({
    id: generateId("loan"),
    propertyId: prop1Id,
    principal: 60000,
    annualRatePct: 1.6,
    termMonths: 220,
    startDate: "2021-04-15",
    interestOnlyMonths: 0,
    upFrontFees: 0,
  });

  // Property 2
  const prop2Id = generateId("prop");
  db.properties.push({
    id: prop2Id,
    organizationId: orgId,
    address: "calle mora de rubielos 18, 2º P6",
    city: "Valencia",
    zip: "46019",
    purchasePrice: 82500,
    purchaseDate: "2021-04-20",
    closingCosts: {
      itp: 8250,
      notary: 1500,
      registry: 900,
      ajd: 1800,
    },
  });

  db.loans.push({
    id: generateId("loan"),
    propertyId: prop2Id,
    principal: 60000,
    annualRatePct: 1.6,
    termMonths: 220,
    startDate: "2021-04-15",
    interestOnlyMonths: 0,
    upFrontFees: 0,
  });

  db.leases.push({
    id: generateId("lease"),
    propertyId: prop2Id,
    tenantName: "Carlos Martínez Ruiz",
    tenantPhone: "+34 698 765 432",
    tenantDNI: "98765432B",
    startDate: "2024-11-01",
    monthlyRent: 890,
    deposit: 1800,
    indexationRule: "ipc",
    isActive: true,
  });

  db.recurringExpenses.push(
    {
      id: generateId("exp"),
      propertyId: prop2Id,
      type: "community",
      amount: 50,
      periodicity: "monthly",
      isDeductible: true,
    },
    {
      id: generateId("exp"),
      propertyId: prop2Id,
      type: "ibi",
      amount: 250,
      periodicity: "yearly",
      isDeductible: true,
    }
  );

  db.oneOffExpenses.push(
    {
      id: generateId("capex"),
      propertyId: prop2Id,
      date: "2024-06-15",
      amount: 850,
      category: "repair",
      description: "Reparación de calentador eléctrico",
      vendor: "Servicio Técnico Valencia",
      invoiceNumber: "ST-2024-334",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop2Id,
      date: "2025-05-10",
      amount: 350,
      category: "repair",
      description: "Reparación de lavadora",
      vendor: "Reparaciones Express",
      invoiceNumber: "REP-2025-078",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop2Id,
      date: "2021-04-25",
      amount: 2200,
      category: "agency",
      description: "Comisión de agencia inmobiliaria por compra",
      vendor: "Inmobiliaria Valencia Center",
      invoiceNumber: "AG-2021-156",
      isDeductible: false,
      notes: "Comisión del 3% sobre precio de compra",
    }
  );

  // Property 3 - cash purchase, no loan
  const prop3Id = generateId("prop");
  db.properties.push({
    id: prop3Id,
    organizationId: orgId,
    address: "Plaza san roque 4, 1ºA",
    city: "El Puig",
    zip: "46540",
    purchasePrice: 83000,
    purchaseDate: "2024-02-10",
    closingCosts: {
      itp: 8300,
      notary: 1000,
      registry: 700,
    },
  });

  db.loans.push({
    id: generateId("loan"),
    propertyId: prop3Id,
    principal: 60000,
    annualRatePct: 1.6,
    termMonths: 330,
    startDate: "2024-05-15",
    interestOnlyMonths: 0,
    upFrontFees: 0,
  });

  db.leases.push({
    id: generateId("lease"),
    propertyId: prop3Id,
    tenantName: "Ana Fernández Sánchez",
    tenantPhone: "+34 645 123 987",
    tenantDNI: "45678912C",
    tenantEmail: "ana.fernandez@email.com",
    startDate: "2024-03-01",
    monthlyRent: 788,
    deposit: 788,
    indexationRule: "ipc",
    isActive: true,
  });

  db.recurringExpenses.push(
    {
      id: generateId("exp"),
      propertyId: prop3Id,
      type: "community",
      amount: 25,
      periodicity: "monthly",
      isDeductible: true,
    },
    {
      id: generateId("exp"),
      propertyId: prop3Id,
      type: "ibi",
      amount: 300,
      periodicity: "yearly",
      isDeductible: true,
    }
  );

  db.oneOffExpenses.push(
    {
      id: generateId("capex"),
      propertyId: prop3Id,
      date: "2024-08-20",
      amount: 1200,
      category: "repair",
      description: "Reparación de instalación eléctrica - cuadro principal",
      vendor: "Electricistas El Puig",
      invoiceNumber: "ELEC-2024-089",
      isDeductible: true,
      notes: "Reparación urgente por fallo en el cuadro eléctrico",
    },
    {
      id: generateId("capex"),
      propertyId: prop3Id,
      date: "2025-02-22",
      amount: 280,
      category: "repair",
      description: "Reparación de grifo del baño",
      vendor: "Fontanería El Puig",
      invoiceNumber: "FONT-2025-045",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop3Id,
      date: "2025-09-10",
      amount: 650,
      category: "appliance",
      description: "Reemplazo de frigorífico",
      vendor: "Electrodomésticos Martín",
      invoiceNumber: "ELEC-2025-234",
      isDeductible: true,
    },
    {
      id: generateId("capex"),
      propertyId: prop3Id,
      date: "2024-02-15",
      amount: 700,
      category: "legal",
      description: "Gastos de registro de la propiedad",
      vendor: "Registro de la Propiedad El Puig",
      invoiceNumber: "REG-2024-023",
      isDeductible: false,
      notes: "Inscripción en el registro tras la compra",
    }
  );
}
