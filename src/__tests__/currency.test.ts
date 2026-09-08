import { describe, it, expect } from 'vitest';
import {
  toOmaniWords,
  toOmaniWordsArabic,
  formatOMR,
  formatOMRCompact,
  formatOMRWithWords,
} from '@/lib/utils/currency';

describe('Currency Utilities', () => {
  describe('toOmaniWords', () => {
    it('should convert zero to words', () => {
      expect(toOmaniWords(0)).toBe('Zero Omani Rials Only');
    });

    it('should convert small amounts correctly', () => {
      expect(toOmaniWords(1)).toBe('One Omani Rial Only');
      expect(toOmaniWords(10)).toBe('Ten Omani Rials Only');
      expect(toOmaniWords(100)).toBe('One Hundred Omani Rials Only');
    });

    it('should handle teens correctly', () => {
      expect(toOmaniWords(11)).toBe('Eleven Omani Rials Only');
      expect(toOmaniWords(15)).toBe('Fifteen Omani Rials Only');
      expect(toOmaniWords(19)).toBe('Nineteen Omani Rials Only');
    });

    it('should handle tens correctly', () => {
      expect(toOmaniWords(20)).toBe('Twenty Omani Rials Only');
      expect(toOmaniWords(50)).toBe('Fifty Omani Rials Only');
      expect(toOmaniWords(99)).toBe('Ninety Nine Omani Rials Only');
    });

    it('should handle hundreds correctly', () => {
      expect(toOmaniWords(100)).toBe('One Hundred Omani Rials Only');
      expect(toOmaniWords(200)).toBe('Two Hundred Omani Rials Only');
      expect(toOmaniWords(999)).toBe('Nine Hundred Ninety Nine Omani Rials Only');
    });

    it('should handle thousands correctly', () => {
      expect(toOmaniWords(1000)).toBe('One Thousand Omani Rials Only');
      expect(toOmaniWords(1500)).toBe('One Thousand Five Hundred Omani Rials Only');
      expect(toOmaniWords(10000)).toBe('Ten Thousand Omani Rials Only');
    });

    it('should handle millions correctly', () => {
      expect(toOmaniWords(1000000)).toBe('One Million Omani Rials Only');
      expect(toOmaniWords(2500000)).toBe('Two Million Five Hundred Thousand Omani Rials Only');
    });

    it('should include baiza for fractional amounts', () => {
      const result = toOmaniWords(123.456);
      expect(result).toContain('One Hundred Twenty Three Omani Rials');
      expect(result).toContain('Four Hundred Fifty Six Baiza');
      expect(result).toContain('Only');
    });

    it('should handle plural forms correctly', () => {
      expect(toOmaniWords(2)).toBe('Two Omani Rials Only');
      // For amounts less than 1 OMR (only baiza), output just the baiza portion
      expect(toOmaniWords(0.5)).toBe('Five Hundred Baiza Only');
    });

    it('should handle decimal precision', () => {
      const result = toOmaniWords(100.001);
      expect(result).toContain('One Hundred Omani Rials');
      expect(result).toContain('One Baiza');
    });
  });

  describe('toOmaniWordsArabic', () => {
    it('should return Arabic placeholder', () => {
      expect(toOmaniWordsArabic(100)).toBe('فقط لا غير');
      expect(toOmaniWordsArabic(0)).toBe('فقط لا غير');
    });
  });

  describe('formatOMR', () => {
    it('should format number with thousand separators and OMR suffix', () => {
      expect(formatOMR(1234.567)).toBe('1,234.567 OMR');
      expect(formatOMR(1000)).toBe('1,000.000 OMR');
      expect(formatOMR(0)).toBe('0.000 OMR');
    });

    it('should use custom decimal places', () => {
      expect(formatOMR(1234.5678, 2)).toBe('1,234.57 OMR');
      expect(formatOMR(1234.5, 2)).toBe('1,234.50 OMR');
    });

    it('should handle very large numbers', () => {
      expect(formatOMR(1234567.89)).toBe('1,234,567.890 OMR');
    });

    it('should handle small numbers', () => {
      expect(formatOMR(0.5)).toBe('0.500 OMR');
      expect(formatOMR(0.001)).toBe('0.001 OMR');
    });
  });

  describe('formatOMRCompact', () => {
    it('should format number without thousand separators', () => {
      expect(formatOMRCompact(1234.567)).toBe('1234.567 OMR');
      expect(formatOMRCompact(1000000)).toBe('1000000.000 OMR');
    });

    it('should use custom decimal places', () => {
      expect(formatOMRCompact(1234.5678, 2)).toBe('1234.57 OMR');
    });
  });

  describe('formatOMRWithWords', () => {
    it('should return both numeric and words representation', () => {
      const result = formatOMRWithWords(1234.567);
      expect(result.numeric).toBe('1,234.567 OMR');
      expect(result.words).toContain('One Thousand Two Hundred Thirty Four');
      expect(result.words).toContain('Baiza');
    });

    it('should handle zero', () => {
      const result = formatOMRWithWords(0);
      expect(result.numeric).toBe('0.000 OMR');
      expect(result.words).toBe('Zero Omani Rials Only');
    });

    it('should handle simple amounts', () => {
      const result = formatOMRWithWords(100);
      expect(result.numeric).toBe('100.000 OMR');
      expect(result.words).toBe('One Hundred Omani Rials Only');
    });
  });
});
