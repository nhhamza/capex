import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/utils/format";

export interface InvestorReportData {
  year: number;
  propertyMetrics: Array<{
    property: string;
    purchasePrice: number;
    currentValue: number;
    equity: number;
    loanAmount: number;
    annualRentalIncome: number;
    annualExpenses: number;
    noi: number;
    capRate: number;
    cashOnCash: number;
    grossYield: number;
    netYield: number;
  }>;
  portfolio: {
    totalInvestment: number;
    totalCurrentValue: number;
    totalEquity: number;
    totalAnnualIncome: number;
    totalAnnualExpenses: number;
    noi: number;
    capRate: number;
    cashOnCash: number;
    grossYield: number;
    netYield: number;
  };
}

export function exportInvestorReportToExcel(investorReportData: InvestorReportData) {
  const { year, propertyMetrics, portfolio } = investorReportData;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Portfolio Summary
  const summaryData = [
    ["REPORTE DE INVERSIÓN - MÉTRICAS DE RENTABILIDAD"],
    ["Año:", year.toString()],
    [""],
    ["RESUMEN DEL PORTFOLIO"],
    ["Inversión Total:", portfolio.totalInvestment.toFixed(2) + " €"],
    ["Valor Actual:", portfolio.totalCurrentValue.toFixed(2) + " €"],
    ["Equity Total:", portfolio.totalEquity.toFixed(2) + " €"],
    ["Ingresos Anuales:", portfolio.totalAnnualIncome.toFixed(2) + " €"],
    ["Gastos Anuales:", portfolio.totalAnnualExpenses.toFixed(2) + " €"],
    ["NOI:", portfolio.noi.toFixed(2) + " €"],
    [""],
    ["MÉTRICAS DE RENTABILIDAD"],
    ["Cap Rate:", portfolio.capRate.toFixed(2) + " %"],
    ["Cash-on-Cash Return:", portfolio.cashOnCash.toFixed(2) + " %"],
    ["Rentabilidad Bruta:", portfolio.grossYield.toFixed(2) + " %"],
    ["Rentabilidad Neta:", portfolio.netYield.toFixed(2) + " %"],
    [""],
    ["DEFINICIONES:"],
    ["Cap Rate: Rentabilidad sobre la inversión inicial (NOI / Precio Compra)"],
    [
      "Cash-on-Cash: Retorno sobre capital propio (NOI / Equity)",
    ],
    ["NOI: Net Operating Income (Ingresos - Gastos operativos)"],
    ["Rentabilidad Bruta: Ingresos / Valor actual"],
    ["Rentabilidad Neta: NOI / Valor actual"],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 50 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Portfolio");

  // Sheet 2: Property Details
  const detailsData = [
    ["DETALLE POR VIVIENDA"],
    ["Año:", year.toString()],
    [""],
    [
      "Vivienda",
      "Valor Compra",
      "Valor Actual",
      "Equity",
      "Préstamo",
      "Ingresos",
      "Gastos",
      "NOI",
      "Cap Rate",
      "Cash-on-Cash",
      "R. Bruta",
      "R. Neta",
    ],
  ];

  propertyMetrics.forEach((metric) => {
    detailsData.push([
      metric.property,
      metric.purchasePrice.toFixed(2) + " €",
      metric.currentValue.toFixed(2) + " €",
      metric.equity.toFixed(2) + " €",
      metric.loanAmount.toFixed(2) + " €",
      metric.annualRentalIncome.toFixed(2) + " €",
      metric.annualExpenses.toFixed(2) + " €",
      metric.noi.toFixed(2) + " €",
      metric.capRate.toFixed(2) + " %",
      metric.cashOnCash.toFixed(2) + " %",
      metric.grossYield.toFixed(2) + " %",
      metric.netYield.toFixed(2) + " %",
    ]);
  });

  // Add totals row
  detailsData.push([""]);
  detailsData.push([
    "TOTALES",
    portfolio.totalInvestment.toFixed(2) + " €",
    portfolio.totalCurrentValue.toFixed(2) + " €",
    portfolio.totalEquity.toFixed(2) + " €",
    "", // loan amount not totaled
    portfolio.totalAnnualIncome.toFixed(2) + " €",
    portfolio.totalAnnualExpenses.toFixed(2) + " €",
    portfolio.noi.toFixed(2) + " €",
    portfolio.capRate.toFixed(2) + " %",
    portfolio.cashOnCash.toFixed(2) + " %",
    portfolio.grossYield.toFixed(2) + " %",
    portfolio.netYield.toFixed(2) + " %",
  ]);

  const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
  wsDetails["!cols"] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, "Detalle por Vivienda");

  // Save file
  const fileName = `reporte-inversion-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportInvestorReportToPDF(investorReportData: InvestorReportData) {
  const { year, propertyMetrics, portfolio } = investorReportData;

  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text("REPORTE DE INVERSIÓN", 20, 20);
  doc.setFontSize(14);
  doc.text("Métricas de Rentabilidad", 20, 30);

  // Year
  doc.setFontSize(12);
  doc.text(`Año: ${year}`, 20, 40);

  // Portfolio Summary section
  doc.setFontSize(14);
  doc.text("Resumen del Portfolio", 20, 55);

  // Portfolio summary data
  const summaryData = [
    ["Concepto", "Importe"],
    ["Inversión Total", formatCurrency(portfolio.totalInvestment)],
    ["Valor Actual", formatCurrency(portfolio.totalCurrentValue)],
    ["Equity Total", formatCurrency(portfolio.totalEquity)],
    ["Ingresos Anuales", formatCurrency(portfolio.totalAnnualIncome)],
    ["Gastos Anuales", formatCurrency(portfolio.totalAnnualExpenses)],
    ["NOI", formatCurrency(portfolio.noi)],
  ];

  autoTable(doc, {
    startY: 60,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [76, 175, 80] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: "right" },
    },
  });

  // Metrics summary
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Métricas de Rentabilidad", 20, finalY);

  const metricsData = [
    ["Métrica", "Valor"],
    ["Cap Rate", portfolio.capRate.toFixed(2) + " %"],
    ["Cash-on-Cash Return", portfolio.cashOnCash.toFixed(2) + " %"],
    ["Rentabilidad Bruta", portfolio.grossYield.toFixed(2) + " %"],
    ["Rentabilidad Neta", portfolio.netYield.toFixed(2) + " %"],
  ];

  autoTable(doc, {
    startY: finalY + 5,
    head: [metricsData[0]],
    body: metricsData.slice(1),
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [33, 150, 243] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: "right" },
    },
  });

  // Property details table - Add new page if needed
  finalY = (doc as any).lastAutoTable.finalY + 20;

  // Check if we need a new page
  if (finalY > 240) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFontSize(14);
  doc.text("Detalle por Vivienda", 20, finalY);

  const tableData = propertyMetrics.map((metric) => [
    metric.property,
    formatCurrency(metric.purchasePrice),
    formatCurrency(metric.currentValue),
    formatCurrency(metric.annualRentalIncome),
    formatCurrency(metric.annualExpenses),
    formatCurrency(metric.noi),
    metric.capRate.toFixed(2) + "%",
    metric.cashOnCash.toFixed(2) + "%",
  ]);

  autoTable(doc, {
    startY: finalY + 10,
    head: [
      [
        "Vivienda",
        "V. Compra",
        "V. Actual",
        "Ingresos",
        "Gastos",
        "NOI",
        "Cap Rate",
        "CoC",
      ],
    ],
    body: tableData,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [76, 175, 80] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
    },
  });

  // Footer note
  finalY = (doc as any).lastAutoTable.finalY + 15;

  // Check if we need a new page for footer
  if (finalY > 260) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFontSize(8);
  doc.text("DEFINICIONES:", 20, finalY);
  doc.text(
    "• Cap Rate: Rentabilidad sobre la inversión inicial (NOI / Precio Compra)",
    20,
    finalY + 5
  );
  doc.text(
    "• Cash-on-Cash (CoC): Retorno sobre capital propio (NOI / Equity)",
    20,
    finalY + 10
  );
  doc.text(
    "• NOI: Net Operating Income (Ingresos - Gastos operativos)",
    20,
    finalY + 15
  );
  doc.text("• Rentabilidad Bruta: Ingresos / Valor actual", 20, finalY + 20);
  doc.text("• Rentabilidad Neta: NOI / Valor actual", 20, finalY + 25);

  // Save file
  const fileName = `reporte-inversion-${year}.pdf`;
  doc.save(fileName);
}
