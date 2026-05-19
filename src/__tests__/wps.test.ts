import { describe, it, expect } from 'vitest';
import { calculateWPS, processWPSFile, generateWPSFile, validateWPSData } from '@/lib/calculations/wps';

describe('WPS Calculations', () => {
  describe('calculateWPS', () => {
    it('should calculate WPS contribution correctly', () => {
      // Standard WPS for Omani: employee 6.5%, employer 10.5%, cap at 3000 OMR
      const result = calculateWPS({
        basicSalary: 2000,
        housingAllowance: 500,
        transportAllowance: 200,
        grossSalary: 2700,
        isOmani: true,
      });

      // Employee: 2700 × 6.5% = 175.5
      // Employer: 2700 × 10.5% = 283.5
      expect(result.employeeShare).toBeCloseTo(175.5, 1);
      expect(result.employerShare).toBeCloseTo(283.5, 1);
      expect(result.totalContribution).toBeCloseTo(459, 1);
    });

    it('should respect 3000 OMR cap', () => {
      const result = calculateWPS({
        basicSalary: 4000,
        housingAllowance: 1000,
        transportAllowance: 500,
        grossSalary: 5500,
        isOmani: true,
      });

      // Cap at 3000: employee = 3000 × 6.5% = 195, employer = 3000 × 10.5% = 315
      expect(result.employeeShare).toBeCloseTo(195, 1);
      expect(result.employerShare).toBeCloseTo(315, 1);
      expect(result.capped).toBe(true);
    });

    it('should skip WPS for non-Omani employees', () => {
      const result = calculateWPS({
        basicSalary: 2000,
        housingAllowance: 500,
        transportAllowance: 200,
        grossSalary: 2700,
        isOmani: false,
      });

      expect(result.employeeShare).toBe(0);
      expect(result.employerShare).toBe(0);
      expect(result.applicable).toBe(false);
    });

    it('should handle zero salary', () => {
      const result = calculateWPS({
        basicSalary: 0,
        housingAllowance: 0,
        transportAllowance: 0,
        grossSalary: 0,
        isOmani: true,
      });

      expect(result.employeeShare).toBe(0);
      expect(result.employerShare).toBe(0);
    });
  });

  describe('validateWPSData', () => {
    it('should validate complete employee data', () => {
      const validData = {
        employeeId: 'emp-1',
        fullName: 'Ahmed Al Balushi',
        civilId: '12345678',
        basicSalary: 1500,
        housingAllowance: 300,
        transportAllowance: 150,
        startDate: '2024-01-01',
        bankName: 'Bank Muscat',
        bankIban: 'OM12BMCT000000001234567890',
      };

      const result = validateWPSData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        fullName: 'Ahmed',
        civilId: '12345678',
        // Missing employeeId, basicSalary, etc.
      };

      const result = validateWPSData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate IBAN format', () => {
      const invalidIban = {
        employeeId: 'emp-1',
        fullName: 'Ahmed',
        basicSalary: 1500,
        bankIban: 'INVALID-IBAN',
      };

      const result = validateWPSData(invalidIban);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'bankIban')).toBe(true);
    });

    it('should validate positive salary amounts', () => {
      const invalidSalary = {
        employeeId: 'emp-1',
        fullName: 'Ahmed',
        basicSalary: -100,
        housingAllowance: 300,
        transportAllowance: 150,
      };

      const result = validateWPSData(invalidSalary);
      expect(result.isValid).toBe(false);
    });
  });
});
