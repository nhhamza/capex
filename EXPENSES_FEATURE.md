# Expense Tracking System for Tax Reporting (Hacienda)

## Overview
This feature replaces the generic "CapEx" concept with a comprehensive expense tracking system designed for Spanish property management and tax reporting compliance. The system allows detailed tracking of all property-related expenses with dates, categories, and deductibility status for annual tax declarations.

## Implementation Details

### 1. Data Model Updates (`types.ts`)
Extended the `OneOffExpense` interface with:
- **9 expense categories**: renovation, repair, maintenance, furniture, appliance, improvement, legal, agency, other
- **description** (required): Detailed description of the expense
- **isDeductible** (optional, default: true): Flag to mark if expense is tax-deductible
- **notes** (optional): Additional context or information

### 2. New Pages Created

#### ExpensesPage (`/src/modules/expenses/ExpensesPage.tsx`)
A dedicated page for managing all property expenses across the portfolio:

**Features:**
- **Property Filter**: View expenses for specific property or all properties
- **Year Filter**: Filter by fiscal year for tax reporting
- **DataGrid Display**: Shows all expenses with 9 columns:
  - Date (formatted)
  - Property address
  - Category (translated to Spanish)
  - Description
  - Amount (formatted as currency)
  - Vendor
  - Invoice number
  - Deductible status (chip indicator)
  - Actions (edit, delete)
  
**Summary Calculations:**
- Total expenses for the filtered period
- Total deductible expenses (for tax purposes)
- Shown at the top of the page

**Export Feature:**
- "Exportar para Hacienda" button
- Prepared to generate CSV/Excel reports for tax declarations
- Currently shows summary alert (ready for implementation with export library)

#### ExpenseFormDialog (`/src/modules/expenses/ExpenseFormDialog.tsx`)
A comprehensive form for adding/editing expenses:

**Form Fields:**
- Property selector (dropdown)
- Date picker
- Category selector (9 options)
- Amount (numeric with validation)
- Description (required, multiline)
- Vendor name
- Invoice number
- Deductible checkbox
- Notes (multiline)

**Features:**
- Integrated with react-hook-form + zod validation
- Pre-fills when editing existing expenses
- Informative alert about tax deductibility rules
- Error handling and loading states

### 3. Updated Components

#### PropertyCapexTab (`PropertyCapexTab.tsx`)
Updated to align with the new expense data model:
- Extended schema with all new fields
- Updated category list to 9 options
- Added description field to the form (required)
- Added notes field to the form
- Maintains existing DataGrid and inline editing functionality

### 4. Navigation Updates

#### Routes (`routes.tsx`)
- Added `/expenses` route pointing to `ExpensesPage`
- Positioned between properties and cashflow routes

#### Layout (`Layout.tsx`)
- Added "Gastos y Reparaciones" menu item with Receipt icon
- Positioned between "Viviendas" and "Cashflow"

### 5. Seed Data (`seed.ts`)
- Updated sample expense with new required fields
- Example: "Reparación de tubería de agua en cocina"
- Includes isDeductible flag set to true

## Tax Reporting Features

### Deductibility Information
The system includes guidance about which expenses are typically tax-deductible in Spain:

**Deductible expenses (typical):**
- Repairs and maintenance
- Insurance
- Community fees (IBI)
- Property taxes
- Agency fees
- Legal fees

**Non-deductible expenses (typical):**
- Major improvements that increase property value
- Renovations (may be amortized differently)

**Note:** Users should consult with a tax advisor (gestor) for specific cases.

### Annual Reporting Workflow
1. Navigate to "Gastos y Reparaciones"
2. Filter by specific year (e.g., 2024)
3. Review all expenses for the fiscal year
4. Check deductible vs non-deductible totals
5. Click "Exportar para Hacienda" to generate report
6. Use report for annual tax declaration

## Technical Implementation

### Technologies Used
- **React Hook Form** + **Zod**: Form validation
- **Material-UI DataGrid**: Expense listing
- **Day.js**: Date handling
- **TypeScript**: Type safety

### Data Flow
1. Expenses stored in mock database (`/mocks/db.ts`)
2. API functions in `/modules/properties/api.ts`
3. Create, read, update, delete operations
4. Real-time updates after each action

### File Structure
```
src/
├── modules/
│   └── expenses/
│       ├── ExpensesPage.tsx         (Main page component)
│       ├── ExpenseFormDialog.tsx    (Form dialog)
│       └── index.ts                 (Module exports)
```

## Usage

### Adding an Expense
1. Navigate to "Gastos y Reparaciones" from the sidebar
2. Click "+ Nuevo Gasto o Reparación"
3. Fill in the form:
   - Select property
   - Choose date
   - Select category
   - Enter amount
   - Write description (required)
   - Optional: vendor, invoice number, notes
   - Check/uncheck "deducible" as needed
4. Click "Guardar"

### Viewing Expenses
- Use property dropdown to filter by specific property
- Use year dropdown to filter by fiscal year
- View totals at the top (total and deductible)

### Editing/Deleting
- Click edit icon to modify expense
- Click delete icon to remove (with confirmation)

### Generating Tax Report
- Filter by the desired fiscal year
- Click "Exportar para Hacienda"
- Export functionality ready for CSV/Excel implementation

## Future Enhancements

### Phase 2 (Optional)
- Implement actual CSV/Excel export with `xlsx` library
- Add expense categories chart (pie chart by category)
- Add monthly expense trend chart
- Bulk upload from CSV
- Attach receipt images (file upload integration)
- Multi-year comparison view
- Advanced filtering (by category, amount range)
- Expense predictions based on historical data

## Benefits

1. **Tax Compliance**: Easy annual reporting for Hacienda
2. **Financial Control**: Track all property-related expenses
3. **Deductibility Tracking**: Know which expenses reduce taxable income
4. **Historical Records**: Complete expense history with invoices
5. **Portfolio Overview**: See expenses across all properties
6. **Audit Trail**: Vendor and invoice tracking for audits

## Notes for Backend Migration

When migrating to real backend:

1. **Database Schema**: Create `one_off_expenses` table with all fields
2. **API Endpoints**: 
   - `GET /api/properties/{id}/expenses` - list expenses
   - `POST /api/expenses` - create expense
   - `PUT /api/expenses/{id}` - update expense
   - `DELETE /api/expenses/{id}` - delete expense
   - `GET /api/expenses/export?year=2024&propertyId=...` - export endpoint
   
3. **Validations**: Server-side validation matching zod schema
4. **File Storage**: If adding receipt uploads, use cloud storage (S3, Azure Blob)
5. **Export Service**: Generate CSV/Excel on backend for better performance

## Summary

The expense tracking system provides a complete solution for managing property expenses with Spanish tax reporting in mind. It replaces the generic CapEx concept with detailed, categorized expense tracking that includes all necessary information for annual Hacienda declarations.

The system is ready to use with the mock database and prepared for future backend integration and enhanced export functionality.
