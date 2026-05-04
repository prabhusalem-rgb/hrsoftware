import { describe, it, expect } from 'vitest';
import { toOmaniWords, toOmaniWordsArabic } from '@/lib/utils/currency';

describe('PDF Utilities', () => {
  describe('toOmaniWords (PDF version)', () => {
    it('should convert amounts to Omani words for PDF', () => {
      const result = toOmaniWords(1234.567);
      expect(result).toContain('One Thousand Two Hundred Thirty Four');
      expect(result).toContain('Omani Rials');
      expect(result).toContain('Baiza');
    });

    it('should handle zero', () => {
      const result = toOmaniWords(0);
      expect(result).toBe('Zero Omani Rials Only');
    });

    it('should handle large amounts', () => {
      const result = toOmaniWords(1000000);
      expect(result).toContain('One Million');
    });
  });

  describe('toOmaniWordsArabic', () => {
    it('should return Arabic text', () => {
      const result = toOmaniWordsArabic(1234);
      expect(result).toBe('فقط لا غير');
    });
  });
});
