import { describe, it, expect, beforeEach } from 'vitest';
import { parseEmployeeExcel, HEADERS } from '@/lib/utils/excel';
import ExcelJS from 'exceljs';

describe('parseEmployeeExcel (real ExcelJS)', () => {
  it('should parse a valid Excel file with all required fields', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Use the same headers as expected by the parser
    worksheet.columns = HEADERS;

    // Add a sample data row
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

    // Add another row with some missing optional fields
    worksheet.addRow({
      emp_code: '0002',
      name_en: 'Mohammed Al Harrasi',
      email: 'mohammed@company.com',
      id_type: 'passport',
      passport_no: 'AB1234567',
      passport_expiry: '2026-12-31',
      nationality: 'OMANI',
      category: 'OMANI_DIRECT_STAFF',
      department: 'Operations',
      designation: 'Manager',
      join_date: '2023-06-15',
      basic_salary: 3000,
      housing_allowance: 500,
      transport_allowance: 300,
      bank_name: 'Bank Muscat',
      bank_bic: 'BMCTOMRX',
      bank_iban: 'OM98BMCT000000009876543210',
      status: 'active',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseEmployeeExcel(buffer as ArrayBuffer);

    expect(result).toHaveLength(2);

    const emp1 = result[0];
    expect(emp1.emp_code).toBe('0001');
    expect(emp1.name_en).toBe('Ahmed Al Balushi');
    expect(emp1.email).toBe('ahmed@company.com');
    expect(emp1.id_type).toBe('civil_id');
    expect(emp1.civil_id).toBe('12345678');
    expect(emp1.nationality).toBe('OMANI');
    expect(emp1.category).toBe('OMANI_INDIRECT_STAFF');
    expect(emp1.department).toBe('Finance');
    expect(emp1.designation).toBe('Accountant');
    expect(emp1.join_date).toBe('2024-01-01');
    expect(emp1.basic_salary).toBe(500);
    expect(emp1.housing_allowance).toBe(100);
    expect(emp1.transport_allowance).toBe(50);
    expect(emp1.bank_iban).toBe('OM12BMCT000000001234567890');
    expect(emp1.status).toBe('active');
    expect(emp1.opening_leave_balance).toBe(0);
    expect(emp1.opening_air_tickets).toBe(0);

    const emp2 = result[1];
    expect(emp2.emp_code).toBe('0002');
    expect(emp2.name_en).toBe('Mohammed Al Harrasi');
    expect(emp2.id_type).toBe('passport');
    expect(emp2.passport_no).toBe('AB1234567');
    expect(emp2.passport_expiry).toBe('2026-12-31');
    expect(emp2.basic_salary).toBe(3000);
  });

  it('should handle alternative column names (case-insensitive, variations)', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Use alternative header names
    worksheet.getRow(1).values = [
      'EMP CODE', 'Full Name', 'Login Email', 'ID Type', 'National ID',
      'Basic Salary', 'Housing', 'Join Date', 'Status'
    ];

    // Add a row with values corresponding to those headers
    // Note: we need to map columns correctly; easier: use addRow with object but headers are custom.
    // Instead, we'll manually set values for each cell in row 2 based on column position.
    const row2 = worksheet.addRow([]);
    row2.getCell(1).value = 'E001';
    row2.getCell(2).value = 'Test User';
    row2.getCell(3).value = 'test@example.com';
    row2.getCell(4).value = 'civil_id';
    row2.getCell(5).value = '98765432';
    row2.getCell(6).value = 1000;
    row2.getCell(7).value = 200;
    row2.getCell(8).value = '2024-01-01';
    row2.getCell(9).value = 'active';

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseEmployeeExcel(buffer as ArrayBuffer);

    expect(result).toHaveLength(1);
    const emp = result[0];
    expect(emp.emp_code).toBe('E001');
    expect(emp.name_en).toBe('Test User');
    expect(emp.email).toBe('test@example.com');
    expect(emp.id_type).toBe('civil_id');
    expect(emp.civil_id).toBe('98765432');
    expect(emp.basic_salary).toBe(1000);
    expect(emp.housing_allowance).toBe(200);
    expect(emp.join_date).toBe('2024-01-01');
    expect(emp.status).toBe('active');
  });

  it('should generate placeholder email if missing', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');
    worksheet.columns = HEADERS;

    worksheet.addRow({
      emp_code: '0003',
      name_en: 'No Email User',
      // email omitted
      id_type: 'civil_id',
      civil_id: '11112222',
      nationality: 'OMANI',
      category: 'OMANI_INDIRECT_STAFF',
      basic_salary: 400,
      housing_allowance: 0,
      transport_allowance: 0,
      bank_name: 'Bank Muscat',
      bank_bic: 'BMCTOMRX',
      bank_iban: 'OM00BMCT0000000000000000',
      status: 'active',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseEmployeeExcel(buffer as ArrayBuffer);

    expect(result).toHaveLength(1);
    const emp = result[0];
    // Row number for this data row is 2 (row 1 is header)
    expect(emp.email).toMatch(/^emp_\d+_2@placeholder\.invalid$/);
  });

  it('should parse date fields to ISO strings', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');
    worksheet.columns = HEADERS;

    worksheet.addRow({
      emp_code: '0004',
      name_en: 'Date Test',
      email: 'date@test.com',
      id_type: 'civil_id',
      civil_id: '55556666',
      nationality: 'OMANI',
      category: 'OMANI_INDIRECT_STAFF',
      join_date: '2025-05-15',
      passport_expiry: '2026-12-31',
      visa_expiry: '2027-01-31',
      basic_salary: 1000,
      housing_allowance: 200,
      transport_allowance: 150,
      bank_name: 'Bank Muscat',
      bank_bic: 'BMCTOMRX',
      bank_iban: 'OM11BMCT000000001111112222',
      status: 'active',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseEmployeeExcel(buffer as ArrayBuffer);

    expect(result).toHaveLength(1);
    const emp = result[0];
    expect(emp.join_date).toBe('2025-05-15');
    expect(emp.passport_expiry).toBe('2026-12-31');
    expect(emp.visa_expiry).toBe('2027-01-31');
  });

  it('should skip rows with missing emp_code or name_en', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');
    worksheet.columns = HEADERS;

    // Valid row
    worksheet.addRow({
      emp_code: '0005',
      name_en: 'Valid Employee',
      email: 'valid@test.com',
      id_type: 'civil_id',
      civil_id: '99998888',
      basic_salary: 100,
      housing_allowance: 0,
      transport_allowance: 0,
      bank_name: 'Bank Muscat',
      bank_bic: 'BMCTOMRX',
      bank_iban: 'OM22BMCT000000002222223333',
      status: 'active',
    });

    // Row missing emp_code
    const row2 = worksheet.addRow([]);
    row2.getCell(1).value = ''; // emp_code empty
    row2.getCell(2).value = 'No Code';
    // ... other cells left empty

    // Row missing name_en
    const row3 = worksheet.addRow([]);
    row3.getCell(1).value = '0006';
    row3.getCell(2).value = '';

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseEmployeeExcel(buffer as ArrayBuffer);

    // Only the valid row should be included
    expect(result).toHaveLength(1);
    expect(result[0].emp_code).toBe('0005');
  });

  it('should handle numeric values correctly', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');
    worksheet.columns = HEADERS;

    worksheet.addRow({
      emp_code: '0007',
      name_en: 'Numeric Test',
      email: 'num@test.com',
      id_type: 'civil_id',
      civil_id: '77776666',
      basic_salary: 1234.56,
      housing_allowance: 789.12,
      transport_allowance: 345.67,
      food_allowance: 50,
      special_allowance: 25.5,
      site_allowance: 100,
      other_allowance: 75.25,
      bank_name: 'Bank Muscat',
      bank_bic: 'BMCTOMRX',
      bank_iban: 'OM33BMCT000000003333334444',
      status: 'active',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await parseEmployeeExcel(buffer as ArrayBuffer);

    expect(result).toHaveLength(1);
    const emp = result[0];
    expect(emp.basic_salary).toBe(1234.56);
    expect(emp.housing_allowance).toBe(789.12);
    expect(emp.transport_allowance).toBe(345.67);
    expect(emp.food_allowance).toBe(50);
    expect(emp.special_allowance).toBe(25.5);
    expect(emp.site_allowance).toBe(100);
    expect(emp.other_allowance).toBe(75.25);
  });
});
