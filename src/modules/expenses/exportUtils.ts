import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OneOffExpense, Property, RecurringExpense } from '@/modules/properties/types';
import { formatDate } from '@/utils/date';

const categoryLabels: Record<string, string> = {
  renovation: 'Reforma',
  repair: 'Reparación',
  maintenance: 'Mantenimiento',
  furniture: 'Mobiliario',
  appliance: 'Electrodoméstico',
  improvement: 'Mejora',
  legal: 'Gastos Legales',
  agency: 'Agencia',
  other: 'Otro',
};

const recurringTypeLabels: Record<string, string> = {
  community: 'Comunidad',
  ibi: 'IBI',
  insurance: 'Seguro',
  garbage: 'Basura',
  adminFee: 'Gestión',
  other: 'Otro',
};

interface ExportOptions {
  expenses: OneOffExpense[];
  recurringExpenses?: RecurringExpense[];
  properties: Property[];
  year: string;
  propertyId?: string;
}

export function exportToExcel(options: ExportOptions) {
  const { expenses, recurringExpenses = [], properties, year, propertyId } = options;

  // Helper to get property address
  const getPropertyAddress = (propId: string) => {
    const prop = properties.find((p) => p.id === propId);
    return prop?.address || 'N/A';
  };

  // Helper to calculate annual amount for recurring expenses
  const getAnnualAmount = (amount: number, periodicity: string) => {
    switch (periodicity) {
      case 'monthly':
        return amount * 12;
      case 'yearly':
        return amount;
      case 'quarterly':
        return amount * 4;
      case 'biannual':
        return amount * 2;
      default:
        return amount;
    }
  };

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Tab 1: Summary (Resumen)
  const deductibleExpenses = expenses.filter((exp) => exp.isDeductible !== false);
  const nonDeductibleExpenses = expenses.filter((exp) => exp.isDeductible === false);
  
  // Calculate recurring expenses totals
  const deductibleRecurring = recurringExpenses.filter((exp) => exp.isDeductible !== false);
  const nonDeductibleRecurring = recurringExpenses.filter((exp) => exp.isDeductible === false);
  
  const totalOneOffExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalDeductibleOneOff = deductibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalNonDeductibleOneOff = nonDeductibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const totalRecurringAnnual = recurringExpenses.reduce((sum, exp) => sum + getAnnualAmount(exp.amount, exp.periodicity), 0);
  const totalDeductibleRecurring = deductibleRecurring.reduce((sum, exp) => sum + getAnnualAmount(exp.amount, exp.periodicity), 0);
  const totalNonDeductibleRecurring = nonDeductibleRecurring.reduce((sum, exp) => sum + getAnnualAmount(exp.amount, exp.periodicity), 0);
  
  const totalExpenses = totalOneOffExpenses + totalRecurringAnnual;
  const totalDeductible = totalDeductibleOneOff + totalDeductibleRecurring;
  const totalNonDeductible = totalNonDeductibleOneOff + totalNonDeductibleRecurring;

  // Group by category
  const byCategory: Record<string, { total: number; deductible: number; nonDeductible: number }> = {};
  expenses.forEach((exp) => {
    const category = categoryLabels[exp.category] || exp.category;
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, deductible: 0, nonDeductible: 0 };
    }
    byCategory[category].total += exp.amount;
    if (exp.isDeductible !== false) {
      byCategory[category].deductible += exp.amount;
    } else {
      byCategory[category].nonDeductible += exp.amount;
    }
  });

  const summaryData = [
    ['RESUMEN DE GASTOS Y REPARACIONES'],
    ['Año:', year === 'all' ? 'Todos' : year],
    ['Vivienda:', propertyId && propertyId !== 'all' ? getPropertyAddress(propertyId) : 'Todas'],
    [''],
    ['TOTALES GENERALES'],
    ['Total de Gastos (Puntuales + Anuales):', totalExpenses.toFixed(2) + ' €'],
    ['  - Gastos Puntuales:', totalOneOffExpenses.toFixed(2) + ' €'],
    ['  - Gastos Fijos Anuales:', totalRecurringAnnual.toFixed(2) + ' €'],
    [''],
    ['Gastos Deducibles:', totalDeductible.toFixed(2) + ' €'],
    ['  - Puntuales Deducibles:', totalDeductibleOneOff.toFixed(2) + ' €'],
    ['  - Fijos Deducibles (anual):', totalDeductibleRecurring.toFixed(2) + ' €'],
    [''],
    ['Gastos No Deducibles:', totalNonDeductible.toFixed(2) + ' €'],
    ['  - Puntuales No Deducibles:', totalNonDeductibleOneOff.toFixed(2) + ' €'],
    ['  - Fijos No Deducibles (anual):', totalNonDeductibleRecurring.toFixed(2) + ' €'],
    [''],
    ['Número de Gastos Puntuales:', expenses.length.toString()],
    ['Número de Gastos Fijos:', recurringExpenses.length.toString()],
    [''],
    ['RESUMEN POR CATEGORÍA (Gastos Puntuales)'],
    ['Categoría', 'Total', 'Deducible', 'No Deducible'],
  ];

  Object.entries(byCategory).forEach(([category, amounts]) => {
    summaryData.push([
      category,
      amounts.total.toFixed(2) + ' €',
      amounts.deductible.toFixed(2) + ' €',
      amounts.nonDeductible.toFixed(2) + ' €',
    ]);
  });
  
  // Add recurring expenses summary
  summaryData.push(['']);
  summaryData.push(['GASTOS FIJOS RECURRENTES (Anualizados)']);
  summaryData.push(['Tipo', 'Importe Anual', 'Deducible']);
  
  recurringExpenses.forEach((exp) => {
    const annualAmount = getAnnualAmount(exp.amount, exp.periodicity);
    summaryData.push([
      recurringTypeLabels[exp.type] || exp.type,
      annualAmount.toFixed(2) + ' €',
      exp.isDeductible === false ? 'No' : 'Sí',
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Set column widths
  wsSummary['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  // Tab 2: All Expenses (Todos los Gastos)
  const allExpensesData = [
    ['LISTADO COMPLETO DE GASTOS Y REPARACIONES'],
    ['Año:', year === 'all' ? 'Todos' : year],
    [''],
    [
      'Fecha',
      'Vivienda',
      'Categoría',
      'Descripción',
      'Importe',
      'Proveedor',
      'Nº Factura',
      'Deducible',
      'Notas',
    ],
  ];

  [...expenses]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((exp) => {
      allExpensesData.push([
        formatDate(exp.date),
        getPropertyAddress(exp.propertyId),
        categoryLabels[exp.category] || exp.category,
        exp.description || '',
        exp.amount.toFixed(2),
        exp.vendor || '',
        exp.invoiceNumber || '',
        exp.isDeductible === false ? 'No' : 'Sí',
        exp.notes || '',
      ]);
    });

  // Add totals row
  allExpensesData.push([]);
  allExpensesData.push([
    '',
    '',
    '',
    'TOTAL:',
    totalExpenses.toFixed(2) + ' €',
    '',
    '',
    '',
    '',
  ]);

  const wsAll = XLSX.utils.aoa_to_sheet(allExpensesData);
  wsAll['!cols'] = [
    { wch: 12 },
    { wch: 30 },
    { wch: 15 },
    { wch: 40 },
    { wch: 12 },
    { wch: 20 },
    { wch: 15 },
    { wch: 10 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, wsAll, 'Todos los Gastos');

  // Tab 3: Deductible Expenses Only (Gastos Deducibles)
  if (deductibleExpenses.length > 0 || deductibleRecurring.length > 0) {
    const deductibleData = [
      ['GASTOS DEDUCIBLES PARA HACIENDA'],
      ['Año:', year === 'all' ? 'Todos' : year],
      [''],
      ['GASTOS PUNTUALES DEDUCIBLES'],
      [
        'Fecha',
        'Vivienda',
        'Categoría',
        'Descripción',
        'Importe',
        'Proveedor',
        'Nº Factura',
        'Notas',
      ],
    ];

    [...deductibleExpenses]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((exp) => {
        deductibleData.push([
          formatDate(exp.date),
          getPropertyAddress(exp.propertyId),
          categoryLabels[exp.category] || exp.category,
          exp.description || '',
          exp.amount.toFixed(2),
          exp.vendor || '',
          exp.invoiceNumber || '',
          exp.notes || '',
        ]);
      });

    deductibleData.push([]);
    deductibleData.push([
      '',
      '',
      '',
      'SUBTOTAL PUNTUALES:',
      totalDeductibleOneOff.toFixed(2) + ' €',
      '',
      '',
      '',
    ]);
    
    // Add recurring deductible expenses
    if (deductibleRecurring.length > 0) {
      deductibleData.push([]);
      deductibleData.push(['GASTOS FIJOS DEDUCIBLES (Anualizados)']);
      deductibleData.push([
        'Tipo',
        'Vivienda',
        'Periodicidad',
        'Importe Periódico',
        'Importe Anual',
        '',
        '',
        'Notas',
      ]);
      
      deductibleRecurring.forEach((exp) => {
        const annualAmount = getAnnualAmount(exp.amount, exp.periodicity);
        deductibleData.push([
          recurringTypeLabels[exp.type] || exp.type,
          getPropertyAddress(exp.propertyId),
          exp.periodicity === 'monthly' ? 'Mensual' : exp.periodicity === 'yearly' ? 'Anual' : exp.periodicity,
          exp.amount.toFixed(2),
          annualAmount.toFixed(2),
          '',
          '',
          exp.notes || '',
        ]);
      });
      
      deductibleData.push([]);
      deductibleData.push([
        '',
        '',
        '',
        'SUBTOTAL FIJOS:',
        totalDeductibleRecurring.toFixed(2) + ' €',
        '',
        '',
        '',
      ]);
    }
    
    deductibleData.push([]);
    deductibleData.push([
      '',
      '',
      '',
      'TOTAL DEDUCIBLE:',
      totalDeductible.toFixed(2) + ' €',
      '',
      '',
      '',
    ]);

    const wsDeductible = XLSX.utils.aoa_to_sheet(deductibleData);
    wsDeductible['!cols'] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, wsDeductible, 'Gastos Deducibles');
  }

  // Tab 4: Non-Deductible Expenses (Gastos No Deducibles)
  if (nonDeductibleExpenses.length > 0) {
    const nonDeductibleData = [
      ['GASTOS NO DEDUCIBLES'],
      ['Año:', year === 'all' ? 'Todos' : year],
      [''],
      [
        'Fecha',
        'Vivienda',
        'Categoría',
        'Descripción',
        'Importe',
        'Proveedor',
        'Nº Factura',
        'Notas',
      ],
    ];

    [...nonDeductibleExpenses]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((exp) => {
        nonDeductibleData.push([
          formatDate(exp.date),
          getPropertyAddress(exp.propertyId),
          categoryLabels[exp.category] || exp.category,
          exp.description || '',
          exp.amount.toFixed(2),
          exp.vendor || '',
          exp.invoiceNumber || '',
          exp.notes || '',
        ]);
      });

    nonDeductibleData.push([]);
    nonDeductibleData.push([
      '',
      '',
      '',
      'TOTAL NO DEDUCIBLE:',
      totalNonDeductible.toFixed(2) + ' €',
      '',
      '',
      '',
    ]);

    const wsNonDeductible = XLSX.utils.aoa_to_sheet(nonDeductibleData);
    wsNonDeductible['!cols'] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, wsNonDeductible, 'Gastos No Deducibles');
  }

  // Tab 5: By Property (Por Vivienda)
  if (propertyId === 'all' || !propertyId) {
    properties.forEach((property) => {
      const propertyExpenses = expenses.filter((exp) => exp.propertyId === property.id);
      
      if (propertyExpenses.length === 0) return;

      const propTotal = propertyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const propDeductible = propertyExpenses
        .filter((exp) => exp.isDeductible !== false)
        .reduce((sum, exp) => sum + exp.amount, 0);

      const propertyData = [
        [property.address],
        ['Total Gastos:', propTotal.toFixed(2) + ' €'],
        ['Gastos Deducibles:', propDeductible.toFixed(2) + ' €'],
        [''],
        [
          'Fecha',
          'Categoría',
          'Descripción',
          'Importe',
          'Proveedor',
          'Nº Factura',
          'Deducible',
        ],
      ];

      [...propertyExpenses]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((exp) => {
          propertyData.push([
            formatDate(exp.date),
            categoryLabels[exp.category] || exp.category,
            exp.description || '',
            exp.amount.toFixed(2),
            exp.vendor || '',
            exp.invoiceNumber || '',
            exp.isDeductible === false ? 'No' : 'Sí',
          ]);
        });

      const wsProperty = XLSX.utils.aoa_to_sheet(propertyData);
      wsProperty['!cols'] = [
        { wch: 12 },
        { wch: 15 },
        { wch: 40 },
        { wch: 12 },
        { wch: 20 },
        { wch: 15 },
        { wch: 10 },
      ];

      // Truncate sheet name if too long (max 31 chars)
      const sheetName = property.address.substring(0, 28) + (property.address.length > 28 ? '...' : '');
      XLSX.utils.book_append_sheet(wb, wsProperty, sheetName);
    });
  }

  // Generate filename
  const yearStr = year === 'all' ? 'Todos' : year;
  const filename = `Gastos_Hacienda_${yearStr}_${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write file
  XLSX.writeFile(wb, filename);
}

export function exportToPDF(options: ExportOptions) {
  const { expenses, recurringExpenses = [], properties, year, propertyId } = options;

  // Helper to get property address
  const getPropertyAddress = (propId: string) => {
    const prop = properties.find((p) => p.id === propId);
    return prop?.address || 'N/A';
  };

  // Helper to calculate annual amount for recurring expenses
  const getAnnualAmount = (amount: number, periodicity: string) => {
    switch (periodicity) {
      case 'monthly':
        return amount * 12;
      case 'yearly':
        return amount;
      case 'quarterly':
        return amount * 4;
      case 'biannual':
        return amount * 2;
      default:
        return amount;
    }
  };

  // Create PDF
  const doc = new jsPDF();

  // Calculate totals
  const deductibleExpenses = expenses.filter((exp) => exp.isDeductible !== false);
  const nonDeductibleExpenses = expenses.filter((exp) => exp.isDeductible === false);
  
  const deductibleRecurring = recurringExpenses.filter((exp) => exp.isDeductible !== false);
  const nonDeductibleRecurring = recurringExpenses.filter((exp) => exp.isDeductible === false);
  
  const totalOneOffExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalDeductibleOneOff = deductibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalNonDeductibleOneOff = nonDeductibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const totalRecurringAnnual = recurringExpenses.reduce((sum, exp) => sum + getAnnualAmount(exp.amount, exp.periodicity), 0);
  const totalDeductibleRecurring = deductibleRecurring.reduce((sum, exp) => sum + getAnnualAmount(exp.amount, exp.periodicity), 0);
  const totalNonDeductibleRecurring = nonDeductibleRecurring.reduce((sum, exp) => sum + getAnnualAmount(exp.amount, exp.periodicity), 0);
  
  const totalExpenses = totalOneOffExpenses + totalRecurringAnnual;
  const totalDeductible = totalDeductibleOneOff + totalDeductibleRecurring;
  const totalNonDeductible = totalNonDeductibleOneOff + totalNonDeductibleRecurring;

  // Group by category
  const byCategory: Record<string, { total: number; deductible: number; nonDeductible: number }> = {};
  expenses.forEach((exp) => {
    const category = categoryLabels[exp.category] || exp.category;
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, deductible: 0, nonDeductible: 0 };
    }
    byCategory[category].total += exp.amount;
    if (exp.isDeductible !== false) {
      byCategory[category].deductible += exp.amount;
    } else {
      byCategory[category].nonDeductible += exp.amount;
    }
  });

  // Page 1: Summary
  doc.setFontSize(18);
  doc.text('RESUMEN DE GASTOS Y REPARACIONES', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Año: ${year === 'all' ? 'Todos' : year}`, 20, 35);
  doc.text(
    `Vivienda: ${propertyId && propertyId !== 'all' ? getPropertyAddress(propertyId) : 'Todas'}`,
    20,
    42
  );

  // Summary table
  autoTable(doc, {
    startY: 50,
    head: [['Concepto', 'Importe']],
    body: [
      ['Total de Gastos (Puntuales + Anuales)', `${totalExpenses.toFixed(2)} €`],
      ['  - Gastos Puntuales', `${totalOneOffExpenses.toFixed(2)} €`],
      ['  - Gastos Fijos Anuales', `${totalRecurringAnnual.toFixed(2)} €`],
      [''],
      ['Gastos Deducibles', `${totalDeductible.toFixed(2)} €`],
      ['  - Puntuales Deducibles', `${totalDeductibleOneOff.toFixed(2)} €`],
      ['  - Fijos Deducibles (anual)', `${totalDeductibleRecurring.toFixed(2)} €`],
      [''],
      ['Gastos No Deducibles', `${totalNonDeductible.toFixed(2)} €`],
      [''],
      ['Número de Gastos Puntuales', expenses.length.toString()],
      ['Número de Gastos Fijos', recurringExpenses.length.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
  });

  // Category breakdown
  const categoryRows = Object.entries(byCategory).map(([category, amounts]) => [
    category,
    `${amounts.total.toFixed(2)} €`,
    `${amounts.deductible.toFixed(2)} €`,
    `${amounts.nonDeductible.toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [['Categoría', 'Total', 'Deducible', 'No Deducible']],
    body: categoryRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
  });

  // Page 2+: All Expenses
  doc.addPage();
  doc.setFontSize(16);
  doc.text('LISTADO COMPLETO DE GASTOS', 105, 20, { align: 'center' });

  const expensesRows = [...expenses]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((exp) => [
      formatDate(exp.date),
      getPropertyAddress(exp.propertyId),
      categoryLabels[exp.category] || exp.category,
      exp.description || '',
      `${exp.amount.toFixed(2)} €`,
      exp.isDeductible === false ? 'No' : 'Sí',
    ]);

  autoTable(doc, {
    startY: 30,
    head: [['Fecha', 'Vivienda', 'Categoría', 'Descripción', 'Importe', 'Deducible']],
    body: expensesRows,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 45 },
      2: { cellWidth: 25 },
      3: { cellWidth: 55 },
      4: { cellWidth: 20 },
      5: { cellWidth: 18 },
    },
  });

  // Add totals row
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    body: [['', '', '', 'TOTAL:', `${totalExpenses.toFixed(2)} €`, '']],
    theme: 'plain',
    styles: { fontStyle: 'bold', fontSize: 10 },
  });

  // Deductible expenses page
  if (deductibleExpenses.length > 0 || deductibleRecurring.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.text('GASTOS DEDUCIBLES PARA HACIENDA', 105, 20, { align: 'center' });
    
    let currentY = 30;

    // One-off deductible expenses
    if (deductibleExpenses.length > 0) {
      doc.setFontSize(12);
      doc.text('Gastos Puntuales Deducibles:', 20, currentY);
      currentY += 10;

      const deductibleRows = [...deductibleExpenses]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((exp) => [
          formatDate(exp.date),
          getPropertyAddress(exp.propertyId),
          categoryLabels[exp.category] || exp.category,
          exp.description || '',
          `${exp.amount.toFixed(2)} €`,
          exp.invoiceNumber || '',
        ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Fecha', 'Vivienda', 'Categoría', 'Descripción', 'Importe', 'Nº Factura']],
        body: deductibleRows,
        theme: 'striped',
        headStyles: { fillColor: [39, 174, 96] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 45 },
          2: { cellWidth: 25 },
          3: { cellWidth: 55 },
          4: { cellWidth: 20 },
          5: { cellWidth: 18 },
        },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 2,
        body: [['', '', '', 'SUBTOTAL PUNTUALES:', `${totalDeductibleOneOff.toFixed(2)} €`, '']],
        theme: 'plain',
        styles: { fontStyle: 'bold', fontSize: 10 },
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Recurring deductible expenses
    if (deductibleRecurring.length > 0) {
      // Check if we need a new page
      if (currentY > 200) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(12);
      doc.text('Gastos Fijos Deducibles (Anualizados):', 20, currentY);
      currentY += 10;
      
      const recurringRows = deductibleRecurring.map((exp) => {
        const annualAmount = getAnnualAmount(exp.amount, exp.periodicity);
        return [
          recurringTypeLabels[exp.type] || exp.type,
          getPropertyAddress(exp.propertyId),
          exp.periodicity === 'monthly' ? 'Mensual' : exp.periodicity === 'yearly' ? 'Anual' : exp.periodicity,
          `${exp.amount.toFixed(2)} €`,
          `${annualAmount.toFixed(2)} €`,
        ];
      });
      
      autoTable(doc, {
        startY: currentY,
        head: [['Tipo', 'Vivienda', 'Periodicidad', 'Importe', 'Anual']],
        body: recurringRows,
        theme: 'striped',
        headStyles: { fillColor: [39, 174, 96] },
        styles: { fontSize: 9 },
      });
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 2,
        body: [['', '', '', 'SUBTOTAL FIJOS:', `${totalDeductibleRecurring.toFixed(2)} €`]],
        theme: 'plain',
        styles: { fontStyle: 'bold', fontSize: 10 },
      });
    }

    // Total
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      body: [['', '', '', 'TOTAL DEDUCIBLE:', `${totalDeductible.toFixed(2)} €`]],
      theme: 'plain',
      styles: { fontStyle: 'bold', fontSize: 12, textColor: [39, 174, 96] },
    });
  }

  // Generate filename
  const yearStr = year === 'all' ? 'Todos' : year;
  const filename = `Gastos_Hacienda_${yearStr}_${new Date().toISOString().split('T')[0]}.pdf`;

  // Save PDF
  doc.save(filename);
}
