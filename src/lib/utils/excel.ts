// ExcelJS is imported dynamically inside functions to reduce initial bundle size

import { Employee, EmployeeFormData, IdType, EmployeeCategory, EmployeeStatus } from '@/types';

const HEADERS = [
  { header: 'Employee Code', key: 'emp_code', width: 15 },
  { header: 'Full Name (English)', key: 'name_en', width: 25 },
  { header: 'Login Email', key: 'email', width: 25 },
  { header: 'ID Type', key: 'id_type', width: 12 },
  { header: 'Civil ID Number', key: 'civil_id', width: 15 },
  { header: 'Passport Number', key: 'passport_no', width: 15 },
  { header: 'Passport Expiry', key: 'passport_expiry', width: 15 },
  { header: 'Visa Number', key: 'visa_no', width: 15 },
  { header: 'Visa Expiry', key: 'visa_expiry', width: 15 },
  { header: 'Nationality', key: 'nationality', width: 15 },
  { header: 'Category', key: 'category', width: 15 },
  { header: 'Department', key: 'department', width: 15 },
  { header: 'Designation', key: 'designation', width: 15 },
  { header: 'Join Date', key: 'join_date', width: 15 },
  { header: 'Basic Salary', key: 'basic_salary', width: 15 },
  { header: 'Housing Allowance', key: 'housing_allowance', width: 15 },
  { header: 'Transport Allowance', key: 'transport_allowance', width: 15 },
  { header: 'Food Allowance', key: 'food_allowance', width: 15 },
  { header: 'Special Allowance', key: 'special_allowance', width: 15 },
  { header: 'Site Allowance', key: 'site_allowance', width: 15 },
  { header: 'Other Allowance', key: 'other_allowance', width: 15 },
  { header: 'Bank Name', key: 'bank_name', width: 20 },
  { header: 'Bank BIC', key: 'bank_bic', width: 15 },
  { header: 'Bank IBAN', key: 'bank_iban', width: 25 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Opening Leave Balance', key: 'opening_leave_balance', width: 10 },
  { header: 'Opening Air Tickets', key: 'opening_air_tickets', width: 10 },
];

/**
 * Generate a sample template for employee import
 */
export async function generateEmployeeTemplate(): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Employees');

  worksheet.columns = HEADERS;

  // Add sample data
  worksheet.addRow({
    emp_code: '0001',
    name_en: 'Ahmed Al Balushi',
    email: 'ahmed@company.com',
    id_type: 'civil_id',
    civil_id: '12345678',
    nationality: 'OMANI',
    category: 'OMANI_INDIRECT_STAFF',
    department: 'Finance',
    designation: 'Accountant',
    join_date: '2024-01-01',
    basic_salary: 500,
    housing_allowance: 100,
    transport_allowance: 50,
    food_allowance: 0,
    special_allowance: 0,
    site_allowance: 0,
    other_allowance: 0,
    bank_name: 'Bank Muscat',
    bank_bic: 'BMCTOMRX',
    bank_iban: 'OM12BMCT000000001234567890',
    status: 'active',
    opening_leave_balance: 0,
    opening_air_tickets: 0,
  });

  // Apply some styling
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  return await workbook.xlsx.writeBuffer() as unknown as Buffer;
}

/**
 * Export current employees to Excel
 */
export async function exportEmployeesToExcel(employees: Employee[]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Employee Roster');

  worksheet.columns = HEADERS;

  employees.forEach(emp => {
    worksheet.addRow({
      emp_code: emp.emp_code,
      name_en: emp.name_en,
      id_type: emp.id_type,
      civil_id: emp.civil_id,
      passport_no: emp.passport_no,
      passport_expiry: emp.passport_expiry,
      visa_no: emp.visa_no,
      visa_expiry: emp.visa_expiry,
      nationality: emp.nationality,
      category: emp.category,
      department: emp.department,
      designation: emp.designation,
      join_date: emp.join_date,
      basic_salary: Number(emp.basic_salary),
      housing_allowance: Number(emp.housing_allowance),
      transport_allowance: Number(emp.transport_allowance),
      food_allowance: Number(emp.food_allowance || 0),
      special_allowance: Number(emp.special_allowance || 0),
      site_allowance: Number(emp.site_allowance || 0),
      other_allowance: Number(emp.other_allowance || 0),
      bank_name: emp.bank_name,
      bank_bic: emp.bank_bic,
      bank_iban: emp.bank_iban,
      status: emp.status,
      opening_leave_balance: emp.opening_leave_balance,
      opening_air_tickets: emp.opening_air_tickets,
    });
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF00B050' } // Emerald green
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  return await workbook.xlsx.writeBuffer() as unknown as Buffer;
}

/**
 * Parse an Excel file and return EmployeeFormData array
 * Uses header-based mapping for flexibility - columns can be in any order
 */
export async function parseEmployeeExcel(buffer: ArrayBuffer): Promise<EmployeeFormData[]> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);
  const employees: EmployeeFormData[] = [];

  if (!worksheet) return [];

  // Read header row to build column mapping
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  const columnMap: Record<string, number> = {};

  // Build mapping: normalized header name -> column index (1-based)
  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value || '').trim().toLowerCase();
    headers.push(header);
    columnMap[header] = colNumber;
  });

  // Define field mapping with possible header variations
  const fieldMappings: Record<string, string[]> = {
    emp_code: ['employee code', 'emp code', 'employeeid', 'empid', 'employee_id', 'code', 'staff id', 'staff id number', 'employee number'],
    name_en: ['full name (english)', 'full name', 'name (english)', 'name_en', 'employee name', 'name', 'english name'],
    id_type: ['id type', 'idtype', 'document type', 'id document type'],
    civil_id: ['civil id', 'civil id number', 'civilid', 'national id', 'id number', 'emirates id', 'civil_id', 'civild id', 'cid', 'cid number', 'civid', 'civil id no', 'civil id no.', 'id no', 'id number', 'national id number'],
    passport_no: ['passport number', 'passport', 'passport no', 'passportno', 'passport_id', 'passport no.'],
    passport_expiry: ['passport expiry', 'passport expiry date', 'passport_expiry', 'passportexpiry', 'passport expiration'],
    visa_no: ['visa number', 'visa', 'visa no', 'visano', 'visa id'],
    visa_expiry: ['visa expiry', 'visa expiry date', 'visa_expiry', 'visaexpiry', 'visa expiration'],
    nationality: ['nationality', 'national', 'citizenship', 'country', 'nationality/country'],
    category: ['category', 'employee category', 'emp category', 'type', 'employee type'],
    department: ['department', 'dept', 'division', 'dept.'],
    designation: ['designation', 'position', 'job title', 'title', 'job'],
    join_date: ['join date', 'joining date', 'start date', 'hire date', 'date of joining', 'employment date'],
    basic_salary: ['basic salary', 'basic', 'basic pay', 'salary', 'base salary'],
    housing_allowance: ['housing allowance', 'housing', 'accommodation', 'housing rent'],
    transport_allowance: ['transport allowance', 'transport', 'transportation', 'travel allowance', 'transportation allowance'],
    food_allowance: ['food allowance', 'food', 'meal allowance', 'meal'],
    special_allowance: ['special allowance', 'special', 'misc allowance', 'miscellaneous'],
    site_allowance: ['site allowance', 'site', 'field allowance', 'field'],
    other_allowance: ['other allowance', 'other', 'additional allowance', 'additional'],
    bank_name: ['bank name', 'bank', 'bank name', 'bank details'],
    bank_bic: ['bank bic', 'bic', 'swift', 'swift code', 'bank swift', 'swift/bic'],
    bank_iban: ['bank iban', 'iban', 'account number', 'bank account', 'account', 'iban number'],
    status: ['status', 'employee status', 'emp status', 'employee state'],
    opening_leave_balance: ['opening leave balance', 'leave balance', 'opening balance', 'annual leave', 'leave days'],
    opening_air_tickets: ['opening air tickets', 'air tickets', 'ticket entitlement', 'opening tickets', 'tickets'],
  };

  // Helper to find column index for a field (function declaration for TDZ safety)
  function getColumnIndex(field: string): number | null {
    const possibleHeaders = fieldMappings[field] || [];
    for (const header of possibleHeaders) {
      if (columnMap[header] !== undefined) {
        return columnMap[header];
      }
    }
    if (['emp_code', 'name_en', 'civil_id', 'passport_no'].includes(field)) {
      console.warn(`⚠️ Column for "${field}" not found. Checked: ${possibleHeaders.join(', ')}. Available: [${headers.join(', ')}]`);
    }
    return null;
  }

  // Validate required columns exist
  const requiredFields = ['emp_code', 'name_en'];
  const missing = requiredFields.filter(f => getColumnIndex(f) === null);
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}. Detected headers: ${headers.join(', ')}. Please ensure your Excel file has these columns.`);
  }

  // Warn if email column is missing (needed for login/profile linking)
  if (getColumnIndex('email') === null) {
    console.warn('⚠️  "Login Email" column not found in Excel. Generated placeholder emails will need to be updated in the employee edit form for each employee before they can log in.');
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const getVal = (field: string) => {
      const colIdx = getColumnIndex(field);
      if (colIdx === null) return undefined;
      const cell = row.getCell(colIdx);
      return cell.value === null ? undefined : cell.value;
    };

    const emp: any = {
      emp_code: String(getVal('emp_code') || ''),
      name_en: String(getVal('name_en') || ''),
      email: String(getVal('email') || `emp_${Date.now()}_${rowNumber}@placeholder.invalid`),
      id_type: (getVal('id_type') || 'civil_id') as IdType,
      civil_id: String(getVal('civil_id') || ''),
      passport_no: String(getVal('passport_no') || ''),
      passport_expiry: getVal('passport_expiry') ? new Date(String(getVal('passport_expiry'))).toISOString().split('T')[0] : null,
      visa_no: String(getVal('visa_no') || ''),
      visa_expiry: getVal('visa_expiry') ? new Date(String(getVal('visa_expiry'))).toISOString().split('T')[0] : null,
      nationality: String(getVal('nationality') || 'OMANI'),
      category: (getVal('category') || 'INDIRECT_STAFF') as EmployeeCategory,
      department: String(getVal('department') || ''),
      designation: String(getVal('designation') || ''),
      join_date: getVal('join_date') ? new Date(String(getVal('join_date'))).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      basic_salary: Number(getVal('basic_salary') || 0),
      housing_allowance: Number(getVal('housing_allowance') || 0),
      transport_allowance: Number(getVal('transport_allowance') || 0),
      food_allowance: Number(getVal('food_allowance') || 0),
      special_allowance: Number(getVal('special_allowance') || 0),
      site_allowance: Number(getVal('site_allowance') || 0),
      other_allowance: Number(getVal('other_allowance') || 0),
      bank_name: String(getVal('bank_name') || 'Bank Muscat'),
      bank_bic: String(getVal('bank_bic') || 'BMCTOMRX'),
      bank_iban: String(getVal('bank_iban') || ''),
      status: (getVal('status') || 'active') as EmployeeStatus,
      opening_leave_balance: Number(getVal('opening_leave_balance') || 0),
      opening_air_tickets: Number(getVal('opening_air_tickets') || 0),
      // Required but not in Excel
      company_id: '',
      termination_date: null,
      leave_settlement_date: null,
      rejoin_date: null,
    };

    if (emp.name_en && emp.emp_code) {
      employees.push(emp as EmployeeFormData);
    }
  });

  return employees;
}
