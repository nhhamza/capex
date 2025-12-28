import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/utils/format";

export interface TaxReportData {
  year: number;
  totalRentalIncome: number;
  totalDeductions: number;
  netTaxableIncome: number;
  propertyReports: Array<{
    property: string;
    rentalIncome: number;
    deductions: number;
    netIncome: number;
  }>;
}

export function exportTaxReportToExcel(taxReportData: TaxReportData) {
  const {
    year,
    totalRentalIncome,
    totalDeductions,
    netTaxableIncome,
    propertyReports,
  } = taxReportData;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ["REPORTE DE HACIENDA - INGRESOS POR ALQUILER"],
    ["Año:", year.toString()],
    [""],
    ["RESUMEN DE INGRESOS Y GASTOS"],
    ["Rendimiento Íntegro:", totalRentalIncome.toFixed(2) + " €"],
    ["Gastos Deducibles:", totalDeductions.toFixed(2) + " €"],
    ["Base Imponible:", netTaxableIncome.toFixed(2) + " €"],
    [""],
    [
      "Nota: Los cálculos consideran todas las habitaciones ocupadas para propiedades por habitaciones.",
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 40 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Ingresos");

  // Sheet 2: Property Details
  const detailsData = [
    ["DETALLE POR VIVIENDA"],
    ["Año:", year.toString()],
    [""],
    [
      "Vivienda",
      "Ingresos por Alquiler",
      "Gastos Deducibles",
      "Rendimiento Neto",
    ],
  ];

  propertyReports.forEach((report) => {
    detailsData.push([
      report.property,
      report.rentalIncome.toFixed(2) + " €",
      report.deductions.toFixed(2) + " €",
      report.netIncome.toFixed(2) + " €",
    ]);
  });

  // Add totals row
  detailsData.push([""]);
  detailsData.push([
    "TOTALES",
    totalRentalIncome.toFixed(2) + " €",
    totalDeductions.toFixed(2) + " €",
    netTaxableIncome.toFixed(2) + " €",
  ]);

  const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
  wsDetails["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsDetails, "Detalle por Vivienda");

  // Save file
  const fileName = `reporte-hacienda-ingresos-${year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportTaxReportToPDF(taxReportData: TaxReportData) {
  const {
    year,
    totalRentalIncome,
    totalDeductions,
    netTaxableIncome,
    propertyReports,
  } = taxReportData;

  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text("REPORTE DE HACIENDA - INGRESOS POR ALQUILER", 20, 20);

  // Year
  doc.setFontSize(12);
  doc.text(`Año Fiscal: ${year}`, 20, 35);

  // Summary section
  doc.setFontSize(14);
  doc.text("Resumen de Ingresos y Gastos", 20, 55);

  // Summary data
  const summaryData = [
    ["Concepto", "Importe"],
    ["Rendimiento Íntegro", formatCurrency(totalRentalIncome)],
    ["Gastos Deducibles", formatCurrency(totalDeductions)],
    ["Base Imponible", formatCurrency(netTaxableIncome)],
  ];

  autoTable(doc, {
    startY: 65,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: "right" },
    },
  });

  // Property details table
  let finalY = (doc as any).lastAutoTable.finalY + 20;

  doc.setFontSize(14);
  doc.text("Detalle por Vivienda", 20, finalY);

  const tableData = propertyReports.map((report) => [
    report.property,
    formatCurrency(report.rentalIncome),
    formatCurrency(report.deductions),
    formatCurrency(report.netIncome),
  ]);

  autoTable(doc, {
    startY: finalY + 10,
    head: [
      [
        "Vivienda",
        "Ingresos por Alquiler",
        "Gastos Deducibles",
        "Rendimiento Neto",
      ],
    ],
    body: tableData,
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 35, halign: "right" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
  });

  // Footer note
  finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(8);
  doc.text(
    "Nota: Los cálculos consideran todas las habitaciones ocupadas para propiedades por habitaciones.",
    20,
    finalY
  );
  doc.text(
    "Los ingresos respetan períodos de alquiler parciales y tasas de vacancia.",
    20,
    finalY + 5
  );

  // Save file
  const fileName = `reporte-hacienda-ingresos-${year}.pdf`;
  doc.save(fileName);
}
