import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as excelUtils from '@/lib/utils/excel';

// Mock ExcelJS dynamically imported
vi.mock('exceljs', () => {
  const mockAddRow = vi.fn();
  const mockGetRow = vi.fn(() => ({ font: null, fill: null }));
  const mockEachRow = vi.fn();

  const MockWorkbook = class {
    worksheets: any[] = [];
    addWorksheet(name: string) {
      const ws = {
        columns: [],
        addRow: mockAddRow,
        getRow: mockGetRow,
        eachRow: mockEachRow,
        getCell: vi.fn(() => ({ value: '' })),
        getColumn: vi.fn(() => ({
          eachCell: vi.fn((cb) => {}),
        })),
      };
      this.worksheets.push(ws);
      return ws;
    }
    get xlsx() {
      return {
        writeBuffer: async () => Buffer.from('mock-excel-data'),
        load: async () => {},
      };
    }
    getWorksheet(index: number) {
      return this.worksheets[index] || null;
    }
  };

  return {
    default: {
      Workbook: MockWorkbook,
    },
  };
});

describe('Excel Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmployeeTemplate', () => {
    it('should generate an Excel template with sample data', async () => {
      const buffer = await excelUtils.generateEmployeeTemplate();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // The content will be mock data since ExcelJS is mocked
      expect(buffer.toString()).toBe('mock-excel-data');
    });
  });

  describe('exportEmployeesToExcel', () => {
    it('should export employees to Excel', async () => {
      const employees = [
        {
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
        },
      ];

      const buffer = await excelUtils.exportEmployeesToExcel(employees);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty employee array', async () => {
      const buffer = await excelUtils.exportEmployeesToExcel([]);
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('parseEmployeeExcel', () => {
    it('should parse valid Excel data', async () => {
      // This would need a more sophisticated mock of ExcelJS to test properly
      // For now, we test edge cases

      const emptyBuffer = new ArrayBuffer(0);
      const result = await excelUtils.parseEmployeeExcel(emptyBuffer);

      expect(result).toEqual([]);
    });

    it('should handle missing required columns', async () => {
      // Create a minimal mock buffer that ExcelJS can't parse
      // In real test we'd create a proper Excel file with missing columns
      const result = await excelUtils.parseEmployeeExcel(new ArrayBuffer(10));
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('HEADERS constant', () => {
    it('should have all required headers defined', () => {
      expect(excelUtils.HEADERS).toBeDefined();
      expect(Array.isArray(excelUtils.HEADERS)).toBe(true);
      expect(excelUtils.HEADERS.length).toBeGreaterThan(0);

      // Check some critical headers exist
      const headerKeys = excelUtils.HEADERS.map((h: any) => h.key);
      expect(headerKeys).toContain('emp_code');
      expect(headerKeys).toContain('name_en');
      expect(headerKeys).toContain('basic_salary');
    });
  });
});
