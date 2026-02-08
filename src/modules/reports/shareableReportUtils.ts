import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Property, Lease } from "@/modules/properties/types";
import { formatCurrency } from "@/utils/format";
import { getMonthlyRentForDate } from "@/modules/properties/calculations";
import dayjs from "dayjs";

export interface ShareReportData {
  properties: Property[];
  leases: Lease[];
  monthlyIncome: number;
  monthlyExpenses: number;
  avgROI: number;
}

/**
 * Generate a shareable text summary for social media
 */
export function generateShareText(data: ShareReportData): string {
  const { properties, monthlyIncome, monthlyExpenses, avgROI } = data;
  const monthlyProfit = monthlyIncome - monthlyExpenses;

  const lines = [
    "📊 Mi Portfolio Inmobiliario con PropietarioPlus",
    "",
    `🏠 Propiedades: ${properties.length}`,
    `💰 Flujo Mensual: ${formatCurrency(monthlyProfit)}`,
    `📈 ROI Promedio: ${avgROI.toFixed(2)}%`,
    "",
    "¡Gestiona tu portfolio inmobiliario como un profesional!",
    "Descubre PropietarioPlus 👇",
  ];

  return lines.join("\n");
}

/**
 * Generate a formatted summary object for different platforms
 */
export function generateSummary(data: ShareReportData): {
  text: string;
  whatsappUrl: string;
  linkedinUrl: string;
} {
  const shareText = generateShareText(data);

  // WhatsApp: encode with whatsapp://send?text=
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  // LinkedIn: use sharer with URL + title
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`;

  return {
    text: shareText,
    whatsappUrl,
    linkedinUrl,
  };
}

/**
 * Generate a shareable PDF report with watermark
 */
export async function generateShareablePDF(
  data: ShareReportData,
  fileName = "portfolio_report.pdf"
): Promise<void> {
  const { properties, leases, monthlyIncome, monthlyExpenses, avgROI } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Mi Portfolio Inmobiliario", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${dayjs().format("DD/MM/YYYY")}`, pageWidth / 2, 28, {
    align: "center",
  });

  // Summary Section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen Ejecutivo", 15, 40);

  const summaryY = 48;
  const summaryData = [
    ["Métrica", "Valor"],
    ["Propiedades", String(properties.length)],
    ["Ingresos Mensuales", formatCurrency(monthlyIncome)],
    ["Gastos Mensuales", formatCurrency(monthlyExpenses)],
    ["Flujo Neto Mensual", formatCurrency(monthlyIncome - monthlyExpenses)],
    ["ROI Promedio", `${avgROI.toFixed(2)}%`],
  ];

  autoTable(doc, {
    startY: summaryY,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    headStyles: {
      fillColor: [51, 122, 183],
      textColor: 255,
      fontStyle: "bold",
    },
    bodyStyles: {
      textColor: 50,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 50 },
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  // Properties Details Section
  if (properties.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de Propiedades", 15, currentY);

    currentY += 8;

    const propertiesData = properties.map((prop) => {
      const propLeases = leases.filter((l) => l.propertyId === prop.id);
      const monthlyRent = propLeases.length
        ? getMonthlyRentForDate(propLeases[0], dayjs())
        : 0;

      return [
        prop.address || "N/A",
        formatCurrency(prop.purchasePrice || 0),
        formatCurrency(monthlyRent),
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["Dirección", "Precio Compra", "Renta Mensual"]],
      body: propertiesData,
      headStyles: {
        fillColor: [76, 175, 80],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 50,
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer with watermark
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Creado con PropietarioPlus • Gestión profesional de portfolios inmobiliarios",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Save PDF
  doc.save(fileName);
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Track analytics events
 * Note: These are placeholder calls; actual analytics setup comes next
 */
export function trackReportExported(format: "pdf" | "excel"): void {
  try {
    // Check if analytics is available
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "report_exported", {
        format,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn("Analytics tracking failed:", error);
  }
}

export function trackReferralShared(
  platform: "whatsapp" | "linkedin" | "clipboard"
): void {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "referral_shared", {
        platform,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn("Analytics tracking failed:", error);
  }
}
