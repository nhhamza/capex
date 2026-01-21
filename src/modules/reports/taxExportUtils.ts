import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/utils/format";

export interface RoomReport {
  roomName: string;
  rentalIncome: number;
  deductions: number;
  netIncome: number;
}

export interface PropertyReport {
  property: string;
  rentalIncome: number;
  deductions: number;
  netIncome: number;
  isPerRoom?: boolean;
  rooms?: RoomReport[];
}

export interface TaxReportData {
  year: number;
  totalRentalIncome: number;
  totalDeductions: number;
  netTaxableIncome: number;
  propertyReports: PropertyReport[];
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
  const detailsData: any[][] = [
    ["DETALLE POR VIVIENDA"],
    ["Año:", year.toString()],
    [""],
    [
      "Vivienda / Habitación",
      "Ingresos por Alquiler",
      "Gastos Deducibles",
      "Rendimiento Neto",
      "% del Total",
    ],
  ];

  propertyReports.forEach((report) => {
    // Add property row
    detailsData.push([
      report.property +
        (report.isPerRoom ? " (Alquiler por habitaciones)" : ""),
      report.rentalIncome.toFixed(2) + " €",
      report.deductions.toFixed(2) + " €",
      report.netIncome.toFixed(2) + " €",
      "",
    ]);

    // Add room details if available
    if (report.rooms && report.rooms.length > 0) {
      report.rooms.forEach((room) => {
        const percentage =
          report.rentalIncome > 0
            ? ((room.rentalIncome / report.rentalIncome) * 100).toFixed(1)
            : "0.0";
        detailsData.push([
          "    • " + room.roomName,
          room.rentalIncome.toFixed(2) + " €",
          room.deductions.toFixed(2) + " €",
          room.netIncome.toFixed(2) + " €",
          percentage + "%",
        ]);
      });
      // Add spacing after rooms
      detailsData.push(["", "", "", "", ""]);
    }
  });

  // Add totals row
  detailsData.push([""]);
  detailsData.push([
    "TOTALES",
    totalRentalIncome.toFixed(2) + " €",
    totalDeductions.toFixed(2) + " €",
    netTaxableIncome.toFixed(2) + " €",
    "",
  ]);

  const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
  wsDetails["!cols"] = [
    { wch: 40 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
  ];
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

  // Build table data with rooms
  const tableData: any[] = [];

  propertyReports.forEach((report) => {
    // Add property row
    const propertyLabel = report.isPerRoom
      ? `${report.property} (Alquiler por habitaciones)`
      : report.property;

    tableData.push([
      propertyLabel,
      formatCurrency(report.rentalIncome),
      formatCurrency(report.deductions),
      formatCurrency(report.netIncome),
    ]);

    // Add room rows if available
    if (report.rooms && report.rooms.length > 0) {
      report.rooms.forEach((room) => {
        const percentage =
          report.rentalIncome > 0
            ? ((room.rentalIncome / report.rentalIncome) * 100).toFixed(1)
            : "0.0";
        tableData.push([
          `    • ${room.roomName} (${percentage}%)`,
          formatCurrency(room.rentalIncome),
          formatCurrency(room.deductions),
          formatCurrency(room.netIncome),
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: finalY + 10,
    head: [
      [
        "Vivienda / Habitación",
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
      0: { cellWidth: 70 },
      1: { cellWidth: 30, halign: "right" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
    willDrawCell: function (data: any) {
      // Style property rows differently from room rows
      if (data.section === "body") {
        const cellText = data.cell.raw as string;
        const isRoomRow = cellText && cellText.toString().startsWith("    •");
        const isPropertyWithRooms =
          cellText && cellText.toString().includes("(Alquiler por habitaciones)");

        if (isPropertyWithRooms) {
          // Property with rooms - bold and light blue background
          data.cell.styles.fillColor = [227, 242, 253]; // #e3f2fd
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [0, 0, 0];
        } else if (isRoomRow) {
          // Room row - lighter background and smaller font
          data.cell.styles.fillColor = [245, 245, 245]; // #f5f5f5
          data.cell.styles.fontSize = 8;
          data.cell.styles.textColor = [100, 100, 100];
        } else if (
          !isRoomRow &&
          data.row.index > 0 &&
          data.row.index < tableData.length - 1
        ) {
          // Regular property row
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  } as any);

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
